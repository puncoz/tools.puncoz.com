import "server-only"
import type { User } from "@workos-inc/node"
import { eq } from "drizzle-orm"
import { serverConfig } from "@/config/server"
import { getDb } from "@/db"
import { type DbUser, users } from "@/db/schema"

/** Addresses are stored lowercased so the unique index is case-insensitive. */
const normaliseEmail = (email: string): string => email.trim().toLowerCase()

const isAdminEmail = (email: string): boolean =>
  serverConfig.access.adminEmails.includes(normaliseEmail(email))

/**
 * Mirrors a WorkOS user into Postgres and returns the local row.
 *
 * Called once per sign-in so profile changes propagate, and again lazily by
 * `requireDbUser` — a sign-in whose sync failed (the write is deliberately
 * non-fatal) must not leave the account unable to own drawings.
 *
 * Resolution order matters:
 *
 *   1. `workosId` — the returning user.
 *   2. `email` — the invite hand-off. An admin can create a row for someone who
 *      has never signed in; their first sign-in claims it and inherits its
 *      already-approved status. This is the only reason `workosId` is nullable.
 *   3. Neither — a stranger. Inserted as `pending`: they get an account and no
 *      access until reviewed.
 *
 * An admin email is force-approved on every sign-in, whatever the stored status,
 * so the owner cannot lock themselves out of their own review screen.
 */
const syncUser = async (workosUser: User): Promise<DbUser> => {
  const db = getDb()
  const email = normaliseEmail(workosUser.email)

  const profile = {
    email,
    emailVerified: workosUser.emailVerified,
    firstName: workosUser.firstName,
    lastName: workosUser.lastName,
    profilePictureUrl: workosUser.profilePictureUrl,
    lastSignInAt: new Date(),
    updatedAt: new Date(),
  }

  const [byWorkosId] = await db
    .select()
    .from(users)
    .where(eq(users.workosId, workosUser.id))
    .limit(1)

  const existing = byWorkosId ?? (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0]

  if (existing) {
    const [row] = await db
      .update(users)
      .set({
        ...profile,
        // Claims an invite row on first sign-in. Already correct for a returning
        // user, so it is written unconditionally rather than branched.
        workosId: workosUser.id,
        ...(isAdminEmail(email) && existing.accessStatus !== "approved"
          ? { accessStatus: "approved" as const, accessReviewedAt: new Date() }
          : {}),
      })
      .where(eq(users.id, existing.id))
      .returning()

    return row
  }

  // An upsert, not an insert: the selects above and this write are not atomic,
  // and more than one render of the same request can be inside that window on a
  // first sign-in — ADR 0005 measured five identity lookups for one navigation,
  // and on a new account every one of them misses. A plain insert loses that
  // race with `23505 users_workos_id_unique`, which would fail the very first
  // page load of every new account.
  //
  // Arbitrated on `email` rather than on `workos_id`, which is the index that
  // actually fires first: `workos_id` is nullable, and nulls are distinct, so an
  // invite row would be duplicated rather than claimed. Conflicting on email
  // makes the race resolve into the same "find the row with this email" lookup
  // the invite hand-off already depends on. See ADR 0006.
  const [row] = await db
    .insert(users)
    .values({
      ...profile,
      workosId: workosUser.id,
      accessStatus: isAdminEmail(email) ? "approved" : "pending",
      accessReviewedAt: isAdminEmail(email) ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        ...profile,
        // Claims the row we lost the race to insert, exactly as the update
        // branch above would have. `accessStatus` is deliberately not reset:
        // reaching here means the row already exists, and demoting an approved
        // account to `pending` because two renders collided would be a bug.
        workosId: workosUser.id,
        // `accessReviewedAt` is left alone for the same reason — the row that
        // won the race carries its own review history.
        ...(isAdminEmail(email) ? { accessStatus: "approved" as const } : {}),
      },
    })
    .returning()

  return row
}

export { isAdminEmail, normaliseEmail, syncUser }
