import "server-only"
import { and, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { type DbDrawing, drawings, users } from "@/db/schema"
import { createShareToken } from "@/lib/drawings/share"

/**
 * Data access for drawings.
 *
 * SECURITY: every function takes `userId` and filters on it. A drawing id alone
 * must never be sufficient to read or write a row — ids are uuids, but they
 * appear in URLs and are not a secret. Route handlers derive `userId` from the
 * session and never from the request.
 *
 * DELETION IS SOFT. `deleteDrawing` stamps `deletedAt` rather than removing the
 * row, so everything that reads or writes a live drawing has to say so — hence
 * `owned()` below, which every such query builds its WHERE from. Adding a query
 * that filters on user and id alone would quietly resurrect trashed drawings
 * into the gallery, so reach for the helper rather than rewriting the pair.
 */

/** A drawing the user owns and has not deleted. The default for everything. */
const owned = (userId: string, id: string) =>
  and(eq(drawings.id, id), eq(drawings.userId, userId), isNull(drawings.deletedAt))

/** The same row once it is in the trash — restore and permanent delete only. */
const ownedTrashed = (userId: string, id: string) =>
  and(eq(drawings.id, id), eq(drawings.userId, userId), isNotNull(drawings.deletedAt))

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
    .where(and(eq(drawings.userId, userId), isNull(drawings.deletedAt)))
    .orderBy(desc(drawings.updatedAt))

/** Trashed drawings, most recently deleted first. */
type TrashedDrawing = DrawingSummary & { deletedAt: Date }

const listTrashedDrawings = async (userId: string): Promise<TrashedDrawing[]> => {
  const rows = await getDb()
    .select({ ...summaryColumns, deletedAt: drawings.deletedAt })
    .from(drawings)
    .where(and(eq(drawings.userId, userId), isNotNull(drawings.deletedAt)))
    .orderBy(desc(drawings.deletedAt))

  // `deletedAt` is non-null on every row the WHERE clause can return, which the
  // column's own nullable type has no way to express.
  return rows as TrashedDrawing[]
}

/** Drives the trash link's badge, so the gallery never loads the trash itself. */
const countTrashedDrawings = async (userId: string): Promise<number> => {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(drawings)
    .where(and(eq(drawings.userId, userId), isNotNull(drawings.deletedAt)))

  return row?.count ?? 0
}

/**
 * A drawing with its document but without its preview.
 *
 * The preview is a data URL that can run to hundreds of kilobytes and is of no
 * use to anything that opens a drawing, so it is fetched only by the two places
 * that actually need the bytes.
 */
// `deletedAt` is dropped as well as the preview: both functions returning this
// filter trashed rows out, so it would be null on every row they can produce and
// would only invite a caller to check something already guaranteed.
type DrawingWithDocument = Omit<DbDrawing, "thumbnail" | "thumbnailDark" | "deletedAt"> & {
  /**
   * Whether the dark preview exists, without loading its bytes. Drives the
   * one-off backfill for drawings rendered before there was a dark variant.
   */
  hasDarkThumbnail: boolean
}

const withDocumentColumns = {
  id: drawings.id,
  userId: drawings.userId,
  title: drawings.title,
  document: drawings.document,
  thumbnailUpdatedAt: drawings.thumbnailUpdatedAt,
  hasDarkThumbnail: sql<boolean>`${drawings.thumbnailDark} is not null`,
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
    .where(owned(userId, id))
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
 *
 * Trashed drawings are excluded, but their token is deliberately left in place
 * rather than revoked: the link is dead while the drawing is in the trash and
 * comes back working if it is restored. Deleting is not meant to be the way you
 * un-share something — the share controls are — and a delete-then-restore should
 * not silently invalidate a link that has been handed out.
 *
 * Banned owners are excluded. Ban is the punitive status and should actually
 * take content offline, rather than leaving it served from this domain
 * indefinitely. Declined and pending owners keep their links: declined means
 * "not admitted", which is no reason to break links already handed out, and a
 * pending user never had tool access to create one.
 */
const getDrawingByShareToken = async (
  token: string,
): Promise<DrawingWithDocument | undefined> => {
  const [row] = await getDb()
    .select(withDocumentColumns)
    .from(drawings)
    .innerJoin(users, eq(users.id, drawings.userId))
    .where(and(
      eq(drawings.shareToken, token),
      isNotNull(drawings.shareToken),
      isNull(drawings.deletedAt),
      ne(users.accessStatus, "banned"),
    ))
    .limit(1)

  return row
}

/**
 * Title and preview for a shared drawing, for the social card.
 *
 * Shares `getDrawingByShareToken`'s WHERE clause exactly, and that is the whole
 * point of it being its own query rather than a looser one: a trashed drawing or
 * a banned owner has to disappear from the preview at the same instant it
 * disappears from the page. A card that keeps rendering a drawing whose link is
 * dead would leak precisely what revoking was meant to stop.
 *
 * Loads only the light variant. The card is composed on the brand colour and is
 * seen in whatever theme the reader's chat client happens to use, which is not
 * something a server can know — so there is one card, and it is the light one.
 */
const getShareThumbnail = async (
  token: string,
): Promise<Pick<DbDrawing, "title" | "thumbnail"> | undefined> => {
  const [row] = await getDb()
    .select({ title: drawings.title, thumbnail: drawings.thumbnail })
    .from(drawings)
    .innerJoin(users, eq(users.id, drawings.userId))
    .where(and(
      eq(drawings.shareToken, token),
      isNotNull(drawings.shareToken),
      isNull(drawings.deletedAt),
      ne(users.accessStatus, "banned"),
    ))
    .limit(1)

  return row
}

/**
 * Only the thumbnail columns, so the serving route never loads the document.
 *
 * The one owner-scoped read that does NOT exclude trashed drawings, because the
 * trash shows previews too — otherwise every card there would be a placeholder
 * letter and picking the right one back out would be guesswork. It is safe: the
 * row is still the caller's own, and a preview is the least of what they can
 * already restore.
 */
const getThumbnail = async (
  userId: string,
  id: string,
): Promise<Pick<DbDrawing, "thumbnail" | "thumbnailDark" | "thumbnailUpdatedAt"> | undefined> => {
  const [row] = await getDb()
    .select({
      thumbnail: drawings.thumbnail,
      thumbnailDark: drawings.thumbnailDark,
      thumbnailUpdatedAt: drawings.thumbnailUpdatedAt,
    })
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
    // Trashed rows are excluded, so a tab left open on a drawing deleted from
    // somewhere else gets a 404 from autosave rather than quietly writing into
    // the trash.
    .where(owned(userId, id))
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
  thumbnailDark: string | null,
): Promise<Date | null | undefined> => {
  // Clearing is driven by the light variant alone: null there means the drawing
  // has no shapes left and so has no preview in either theme. A null dark
  // variant beside a present light one is the ordinary state of a drawing that
  // predates the column, and must not wipe the one preview it does have.
  const cleared = thumbnail === null

  const [row] = await getDb()
    .update(drawings)
    .set({
      thumbnail,
      thumbnailDark: cleared ? null : thumbnailDark,
      thumbnailUpdatedAt: cleared ? null : new Date(),
    })
    .where(owned(userId, id))
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
      thumbnailDark: drawings.thumbnailDark,
      thumbnailUpdatedAt: drawings.thumbnailUpdatedAt,
    })
    .from(drawings)
    .where(owned(userId, id))
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
      thumbnailDark: source.thumbnailDark,
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
    .where(owned(userId, id))
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
    .where(owned(userId, id))
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
    .where(owned(userId, id))
    .returning({ shareToken: drawings.shareToken, sharedAt: drawings.sharedAt })

  return row
}

/** Revokes the link. The next request for it is a 404. */
const revokeSharing = async (userId: string, id: string): Promise<boolean> => {
  const rows = await getDb()
    .update(drawings)
    .set({ shareToken: null, sharedAt: null })
    .where(owned(userId, id))
    .returning({ id: drawings.id })

  return rows.length > 0
}

const touchDrawing = async (userId: string, id: string): Promise<void> => {
  await getDb()
    .update(drawings)
    .set({ lastOpenedAt: new Date() })
    .where(owned(userId, id))
}

/**
 * Moves a drawing to the trash.
 *
 * Nothing is destroyed: the document, its preview and its share token all stay
 * on the row, and `updatedAt` is left alone so the drawing sorts back into the
 * same place in the gallery if it is restored. Deleting the wrong card is the
 * cheapest mistake to make in a grid of thumbnails, and the only one that used
 * to be unrecoverable.
 */
const deleteDrawing = async (userId: string, id: string): Promise<boolean> => {
  const rows = await getDb()
    .update(drawings)
    .set({ deletedAt: new Date() })
    .where(owned(userId, id))
    .returning({ id: drawings.id })

  return rows.length > 0
}

/** Brings a drawing back out of the trash, share link and all. */
const restoreDrawing = async (
  userId: string,
  id: string,
): Promise<DrawingSummary | undefined> => {
  const [row] = await getDb()
    .update(drawings)
    .set({ deletedAt: null })
    .where(ownedTrashed(userId, id))
    .returning(summaryColumns)

  return row
}

/**
 * Removes a trashed drawing for good.
 *
 * Scoped to `ownedTrashed` so this cannot reach a live drawing: everything has
 * to pass through the trash first, which means the destructive path always has
 * a deliberate second step behind it.
 */
const purgeDrawing = async (userId: string, id: string): Promise<boolean> => {
  const rows = await getDb()
    .delete(drawings)
    .where(ownedTrashed(userId, id))
    .returning({ id: drawings.id })

  return rows.length > 0
}

/** Same, for everything in the trash at once. Returns how many rows went. */
const emptyTrash = async (userId: string): Promise<number> => {
  const rows = await getDb()
    .delete(drawings)
    .where(and(eq(drawings.userId, userId), isNotNull(drawings.deletedAt)))
    .returning({ id: drawings.id })

  return rows.length
}

export {
  countTrashedDrawings,
  createDrawing,
  deleteDrawing,
  duplicateDrawing,
  emptyTrash,
  getDrawing,
  getDrawingByShareToken,
  getShareState,
  getShareThumbnail,
  getThumbnail,
  listDrawings,
  listTrashedDrawings,
  purgeDrawing,
  renameDrawing,
  restoreDrawing,
  revokeSharing,
  saveDocument,
  saveThumbnail,
  setSharing,
  touchDrawing,
}
export type { DrawingSummary, DrawingWithDocument, ShareState, TrashedDrawing }
