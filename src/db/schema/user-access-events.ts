import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { type AccessStatus, users } from "@/db/schema/users"

/** Who caused a transition. `system` covers sign-in and admin auto-approval. */
export const ACCESS_EVENT_SOURCES = ["admin", "self", "system"] as const

export type AccessEventSource = typeof ACCESS_EVENT_SOURCES[number]

/**
 * Every change to a user's access, appended.
 *
 * The current status stays denormalised on the user row because it is read on
 * every authenticated request; this table is only read by the admin screen. It
 * exists so a decision made months ago still has its reason attached — "why is
 * this person banned" is exactly the question a status column cannot answer.
 */
export const userAccessEvents = pgTable("user_access_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fromStatus: text("from_status").notNull().$type<AccessStatus>(),
  toStatus: text("to_status").notNull().$type<AccessStatus>(),
  /** The admin's reason, or the user's message when reapplying. */
  note: text("note"),
  /** The acting user; null for system transitions, which have no actor. */
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  source: text("source").notNull().$type<AccessEventSource>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("user_access_events_user_idx").on(table.userId, table.createdAt.desc()),
])

export type DbUserAccessEvent = typeof userAccessEvents.$inferSelect
export type NewDbUserAccessEvent = typeof userAccessEvents.$inferInsert
