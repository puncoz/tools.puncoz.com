import "server-only"
import type { User } from "@workos-inc/node"
import { sql } from "drizzle-orm"
import { getDb } from "@/db"
import { type DbUser, users } from "@/db/schema"

/**
 * Mirrors a WorkOS user into Postgres and returns the local row.
 *
 * Called once per sign-in so profile changes propagate, and again lazily by
 * `requireDbUser` — a sign-in whose sync failed (the write is deliberately
 * non-fatal) must not leave the account unable to own drawings.
 */
const syncUser = async (workosUser: User): Promise<DbUser> => {
  const [row] = await getDb()
    .insert(users)
    .values({
      workosId: workosUser.id,
      email: workosUser.email,
      emailVerified: workosUser.emailVerified,
      firstName: workosUser.firstName,
      lastName: workosUser.lastName,
      profilePictureUrl: workosUser.profilePictureUrl,
      lastSignInAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.workosId,
      set: {
        email: sql`excluded.email`,
        emailVerified: sql`excluded.email_verified`,
        firstName: sql`excluded.first_name`,
        lastName: sql`excluded.last_name`,
        profilePictureUrl: sql`excluded.profile_picture_url`,
        lastSignInAt: sql`excluded.last_sign_in_at`,
        updatedAt: new Date(),
      },
    })
    .returning()

  return row
}

export { syncUser }
