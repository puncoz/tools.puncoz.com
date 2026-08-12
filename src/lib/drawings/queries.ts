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

/** Shape used by the drawing list — deliberately omits the heavy document. */
type DrawingSummary = Pick<DbDrawing, "id" | "title" | "updatedAt">

const listDrawings = async (userId: string): Promise<DrawingSummary[]> =>
  getDb()
    .select({ id: drawings.id, title: drawings.title, updatedAt: drawings.updatedAt })
    .from(drawings)
    .where(eq(drawings.userId, userId))
    .orderBy(desc(drawings.updatedAt))

const getDrawing = async (userId: string, id: string): Promise<DbDrawing | undefined> => {
  const [row] = await getDb()
    .select()
    .from(drawings)
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .limit(1)

  return row
}

const getMostRecentDrawing = async (userId: string): Promise<DrawingSummary | undefined> => {
  const [row] = await getDb()
    .select({ id: drawings.id, title: drawings.title, updatedAt: drawings.updatedAt })
    .from(drawings)
    .where(eq(drawings.userId, userId))
    .orderBy(desc(drawings.updatedAt))
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

const renameDrawing = async (
  userId: string,
  id: string,
  title: string,
): Promise<DbDrawing | undefined> => {
  const [row] = await getDb()
    .update(drawings)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(drawings.id, id), eq(drawings.userId, userId)))
    .returning()

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
  getDrawing,
  getMostRecentDrawing,
  listDrawings,
  renameDrawing,
  saveDocument,
  touchDrawing,
}
export type { DrawingSummary }
