import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "@/db/schema/users"

/**
 * A tldraw document owned by a user.
 *
 * `document` holds the `document` half of a tldraw snapshot — shapes, pages and
 * bindings. The `session` half (camera position, selection) is deliberately not
 * stored: it is per-device, and persisting it would make the viewport jump when
 * the same drawing is opened elsewhere.
 */
export const drawings = pgTable("drawings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled"),
  document: jsonb("document").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
}, table => [
  // Drives both the drawing list and the "most recent" redirect on /draw.
  index("drawings_user_updated_idx").on(table.userId, table.updatedAt.desc()),
])

export type DbDrawing = typeof drawings.$inferSelect
export type NewDbDrawing = typeof drawings.$inferInsert
