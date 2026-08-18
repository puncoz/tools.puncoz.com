import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"

/** The access lifecycle. Only `approved` may reach a tool. */
export const ACCESS_STATUSES = ["pending", "approved", "declined", "banned"] as const

export type AccessStatus = typeof ACCESS_STATUSES[number]

/**
 * Local mirror of a WorkOS user. `id` is ours so future tables reference a local
 * key rather than coupling to the identity provider; `workosId` is the join key.
 *
 * A row can also exist *before* any WorkOS identity does: inviting someone by
 * email creates one with a null `workosId` and an already-approved status, which
 * their first sign-in claims by matching on email.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable because an invite row predates the identity it will belong to.
  // Still unique — Postgres treats nulls as distinct, so any number of
  // outstanding invites coexist under the constraint.
  workosId: text("workos_id").unique(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profilePictureUrl: text("profile_picture_url"),

  // Authentication says who you are; this says whether you may use anything.
  // Defaults to pending: a new sign-in gets an account and no access.
  accessStatus: text("access_status").notNull().default("pending").$type<AccessStatus>(),
  /** The most recent admin note, shown to the user on /account. */
  accessNote: text("access_note"),
  accessReviewedAt: timestamp("access_reviewed_at", { withTimezone: true }),
  accessReviewedBy: uuid("access_reviewed_by"),
  /** Null until the first reapply; the cooldown only governs successive ones. */
  lastReappliedAt: timestamp("last_reapplied_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
}, table => [
  index("users_email_idx").on(table.email),
  // Load-bearing for invites: linking an invite to a sign-in means "find the row
  // with this email", which is only sound if at most one row can hold it.
  // Addresses are lowercased on write so the constraint is case-insensitive in
  // practice without an expression index.
  uniqueIndex("users_email_unique").on(table.email),
  index("users_access_status_idx").on(table.accessStatus),
])

export type DbUser = typeof users.$inferSelect
export type NewDbUser = typeof users.$inferInsert
