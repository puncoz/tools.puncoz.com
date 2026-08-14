import "server-only"
import { and, desc, eq, isNotNull, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { type DbDrawing, drawings } from "@/db/schema"
import { createShareToken } from "@/lib/drawings/share"

/**
 * Data access for drawings.
 *
 * SECURITY: every function takes `userId` and filters on it. A drawing id alone
 * must never be sufficient to read or write a row — ids are uuids, but they
 * appear in URLs and are not a secret. Route handlers derive `userId` from the
 * session and never from the request.
 */

/**
 * Shape used by the drawing list — deliberately omits both heavy columns.
 *
 * `thumbnailUpdatedAt` stands in for the thumbnail itself: a non-null value means
 * there is one to fetch, and its value is the cache buster on that fetch. Loading
 * the data URLs here would put megabytes of base64 into the gallery's HTML.
 */
type DrawingSummary = Pick<DbDrawing, "id" | "title" | "updatedAt" | "thumbnailUpdatedAt"> & {
  isShared: boolean
}

/**
 * `isShared` rather than the token itself, deliberately. A token is a live
 * credential; putting every one of them into the gallery's HTML would leak them
 * into any screenshot or screen-share of that page. The token is fetched only
 * when the owner actually opens the share controls.
 */
const summaryColumns = {
  id: drawings.id,
  title: drawings.title,
  updatedAt: drawings.updatedAt,
  thumbnailUpdatedAt: drawings.thumbnailUpdatedAt,
  // `sql<boolean>` rather than the `isNotNull` helper: the helper's inferred type
  // is `unknown` in a select list, and postgres.js already hands back a real
  // boolean here, so no runtime mapping is needed either.
  isShared: sql<boolean>`${drawings.shareToken} is not null`,
}

const listDrawings = async (userId: string): Promise<DrawingSummary[]> =>
  getDb()
    .select(summaryColumns)
    .from(drawings)
    .where(eq(drawings.userId, userId))
    .orderBy(desc(drawings.updatedAt))

/**
 * A drawing with its document but without its preview.
 *
 * The preview is a data URL that can run to hundreds of kilobytes and is of no
 * use to anything that opens a drawing, so it is fetched only by the two places
 * that actually need the bytes.
 */
type DrawingWithDocument = Omit<DbDrawing, "thumbnail">

const withDocumentColumns = {
  id: drawings.id,
  userId: drawings.userId,
  title: drawings.title,
  document: drawings.document,
  thumbnailUpdatedAt: drawings.thumbnailUpdatedAt,
  shareToken: drawings.shareToken,
  sharedAt: drawings.sharedAt,
  createdAt: drawings.createdAt,
  updatedAt: drawings.updatedAt,
  lastOpenedAt: drawings.lastOpenedAt,
}

const getDrawing = async (
  userId: string,
  id: string,
): Promise<DrawingWithDocument | undefined> => {
  const [row] = await getDb()
    .select(withDocumentColumns)
    .from(drawings)
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .limit(1)

  return row
}

/**
 * Resolves a drawing from a share token alone.
 *
 * THIS IS THE ONE EXCEPTION to the rule at the top of this file, and it is an
 * exception rather than an erosion of it. Every other function here takes a
 * `userId` because a drawing id travels in URLs and is not a secret. A share
 * token is the opposite: it is 256 bits of randomness whose sole purpose is to
 * authenticate its holder, so it stands on its own.
 *
 * The `isNotNull` clause is load-bearing. Without it a null token would match the
 * null column of every unshared drawing, and revoking a link would hand out
 * everything instead of nothing.
 *
 * Returns the document but never the thumbnail — the public page renders the
 * canvas, not a preview.
 */
const getDrawingByShareToken = async (
  token: string,
): Promise<DrawingWithDocument | undefined> => {
  const [row] = await getDb()
    .select(withDocumentColumns)
    .from(drawings)
    .where(and(eq(drawings.shareToken, token), isNotNull(drawings.shareToken)))
    .limit(1)

  return row
}

/** Only the thumbnail columns, so the serving route never loads the document. */
const getThumbnail = async (
  userId: string,
  id: string,
): Promise<Pick<DbDrawing, "thumbnail" | "thumbnailUpdatedAt"> | undefined> => {
  const [row] = await getDb()
    .select({ thumbnail: drawings.thumbnail, thumbnailUpdatedAt: drawings.thumbnailUpdatedAt })
    .from(drawings)
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .limit(1)

  return row
}

const createDrawing = async (
  userId: string,
  { title = "Untitled", document = {} }: { title?: string, document?: unknown } = {},
): Promise<DbDrawing> => {
  const [row] = await getDb()
    .insert(drawings)
    .values({ userId, title, document, lastOpenedAt: new Date() })
    .returning()

  return row
}

/** Returns undefined when the drawing does not exist or belongs to someone else. */
const saveDocument = async (
  userId: string,
  id: string,
  document: unknown,
): Promise<DbDrawing | undefined> => {
  const [row] = await getDb()
    .update(drawings)
    .set({ document, updatedAt: new Date() })
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .returning()

  return row
}

/**
 * Writes a preview, or clears it when passed null.
 *
 * Pointedly does not touch `updatedAt`. Rendering a preview is not a user edit,
 * and bumping the timestamp would reorder the gallery every time a drawing was
 * merely opened. `thumbnailUpdatedAt` carries that change instead, which is also
 * what busts the cache on the thumbnail URL.
 */
const saveThumbnail = async (
  userId: string,
  id: string,
  thumbnail: string | null,
): Promise<Date | null | undefined> => {
  const [row] = await getDb()
    .update(drawings)
    .set({ thumbnail, thumbnailUpdatedAt: thumbnail === null ? null : new Date() })
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .returning({ thumbnailUpdatedAt: drawings.thumbnailUpdatedAt })

  return row?.thumbnailUpdatedAt
}

/**
 * Copies a drawing into a new row of the same account.
 *
 * Reads through the user-scoped `getDrawing` first, so an id belonging to someone
 * else cannot be copied into your own drawings.
 */
const duplicateDrawing = async (
  userId: string,
  id: string,
): Promise<DrawingSummary | undefined> => {
  // One of the two places that reads the preview bytes: the copy carries them
  // over so it has a preview immediately.
  const [source] = await getDb()
    .select({
      title: drawings.title,
      document: drawings.document,
      thumbnail: drawings.thumbnail,
      thumbnailUpdatedAt: drawings.thumbnailUpdatedAt,
    })
    .from(drawings)
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .limit(1)

  if (!source) {
    return undefined
  }

  const [row] = await getDb()
    .insert(drawings)
    .values({
      userId,
      title: `${source.title} copy`.slice(0, 200),
      document: source.document,
      // Carried over so the copy has a preview immediately rather than showing a
      // placeholder until someone opens it.
      thumbnail: source.thumbnail,
      thumbnailUpdatedAt: source.thumbnailUpdatedAt,
      lastOpenedAt: new Date(),
    })
    .returning(summaryColumns)

  return row
}

// Returns a summary rather than the whole row: the document and thumbnail are
// both large, and no caller of a rename wants either echoed back.
const renameDrawing = async (
  userId: string,
  id: string,
  title: string,
): Promise<DrawingSummary | undefined> => {
  const [row] = await getDb()
    .update(drawings)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .returning(summaryColumns)

  return row
}

type ShareState = { shareToken: string | null, sharedAt: Date | null }

/** Reads the current share state. Owner-scoped: this hands back a credential. */
const getShareState = async (
  userId: string,
  id: string,
): Promise<ShareState | undefined> => {
  const [row] = await getDb()
    .select({ shareToken: drawings.shareToken, sharedAt: drawings.sharedAt })
    .from(drawings)
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .limit(1)

  return row
}

/**
 * Turns sharing on, or rotates the token of a drawing that is already shared.
 *
 * Without `rotate` an already-shared drawing keeps its token, so opening the
 * share controls twice does not quietly invalidate a link that has been sent out.
 * With it, the previous link stops working immediately — that is the whole point,
 * and it is why rotating is a separate, explicit action in the UI.
 */
const setSharing = async (
  userId: string,
  id: string,
  { rotate = false }: { rotate?: boolean } = {},
): Promise<ShareState | undefined> => {
  const current = await getShareState(userId, id)

  if (!current) {
    return undefined
  }

  if (current.shareToken && !rotate) {
    return current
  }

  const [row] = await getDb()
    .update(drawings)
    .set({ shareToken: createShareToken(), sharedAt: new Date() })
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .returning({ shareToken: drawings.shareToken, sharedAt: drawings.sharedAt })

  return row
}

/** Revokes the link. The next request for it is a 404. */
const revokeSharing = async (userId: string, id: string): Promise<boolean> => {
  const rows = await getDb()
    .update(drawings)
    .set({ shareToken: null, sharedAt: null })
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .returning({ id: drawings.id })

  return rows.length > 0
}

const touchDrawing = async (userId: string, id: string): Promise<void> => {
  await getDb()
    .update(drawings)
    .set({ lastOpenedAt: new Date() })
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
}

const deleteDrawing = async (userId: string, id: string): Promise<boolean> => {
  const rows = await getDb()
    .delete(drawings)
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .returning({ id: drawings.id })

  return rows.length > 0
}

export {
  createDrawing,
  deleteDrawing,
  duplicateDrawing,
  getDrawing,
  getDrawingByShareToken,
  getShareState,
  getThumbnail,
  listDrawings,
  renameDrawing,
  revokeSharing,
  saveDocument,
  saveThumbnail,
  setSharing,
  touchDrawing,
}
export type { DrawingSummary, DrawingWithDocument, ShareState }
