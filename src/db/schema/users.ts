import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/**
 * Local mirror of a WorkOS user. `id` is ours so future tables reference a local
 * key rather than coupling to the identity provider; `workosId` is the join key.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workosId: text("workos_id").notNull().unique(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profilePictureUrl: text("profile_picture_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
}, table => [
  index("users_email_idx").on(table.email),
])

export type DbUser = typeof users.$inferSelect
export type NewDbUser = typeof users.$inferInsert
