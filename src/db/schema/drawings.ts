import { sql } from "drizzle-orm"
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { users } from "@/db/schema/users"

/**
 * A tldraw document owned by a user.
 *
 * `document` holds the `document` half of a tldraw snapshot — shapes, pages and
 * bindings. The `session` half (camera position, selection) is deliberately not
 * stored: it is per-device, and persisting it would make the viewport jump when
 * the same drawing is opened elsewhere.
 *
 * `thumbnail` is a data URL rendered in the browser for the gallery. It is never
 * selected by the list query — `thumbnailUpdatedAt` stands in for "has one", and
 * the bytes are fetched per card from their own route.
 */
export const drawings = pgTable("drawings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled"),
  document: jsonb("document").notNull(),
  thumbnail: text("thumbnail"),
  // Tracked separately from `updatedAt`, which a thumbnail write must not touch:
  // re-rendering a preview is not a user edit and must not reorder the gallery.
  // It doubles as the cache buster on the thumbnail URL, which `updatedAt` could
  // not be — the two writes are debounced independently, so a preview can change
  // while `updatedAt` stands still.
  thumbnailUpdatedAt: timestamp("thumbnail_updated_at", { withTimezone: true }),
  // Null means not shared. A non-null token is a bearer credential: whoever holds
  // it can read this drawing without signing in. Sharing is off until switched on.
  shareToken: text("share_token"),
  sharedAt: timestamp("shared_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
  // Null means live. Deleting moves a drawing to the trash by stamping this
  // instead of removing the row, so the document, its preview and its share
  // token all survive a mistake. Every read is filtered on it — see the note at
  // the top of `lib/drawings/queries.ts`.
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, table => [
  // Drives the drawing gallery's ordering.
  index("drawings_user_updated_idx").on(table.userId, table.updatedAt.desc()),
  // Drives the trash view, and is partial so it indexes only the handful of
  // rows that are actually in the trash rather than every drawing.
  index("drawings_user_deleted_idx")
    .on(table.userId, table.deletedAt.desc())
    .where(sql`${table.deletedAt} is not null`),
  // Makes lookup by share token a single indexed read, and turns a token
  // collision into a write error rather than two drawings sharing a link.
  // Postgres treats nulls as distinct here, so unshared rows are unconstrained.
  uniqueIndex("drawings_share_token_idx").on(table.shareToken),
])

export type DbDrawing = typeof drawings.$inferSelect
export type NewDbDrawing = typeof drawings.$inferInsert
