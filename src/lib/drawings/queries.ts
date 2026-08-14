import "server-only"
import { and, desc, eq } from "drizzle-orm"
import { getDb } from "@/db"
import { type DbDrawing, drawings } from "@/db/schema"

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
type DrawingSummary = Pick<DbDrawing, "id" | "title" | "updatedAt" | "thumbnailUpdatedAt">

const summaryColumns = {
  id: drawings.id,
  title: drawings.title,
  updatedAt: drawings.updatedAt,
  thumbnailUpdatedAt: drawings.thumbnailUpdatedAt,
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
  getThumbnail,
  listDrawings,
  renameDrawing,
  saveDocument,
  saveThumbnail,
  touchDrawing,
}
export type { DrawingSummary, DrawingWithDocument }
