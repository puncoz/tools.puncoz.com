import "server-only"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { type DbUser, users } from "@/db/schema"
import { getCurrentUser, requireAuth } from "@/lib/auth/session"
import { syncUser } from "@/lib/auth/sync-user"
import type { User } from "@workos-inc/node"

/**
 * Resolves a WorkOS user to its local row, creating it if absent.
 *
 * The sign-in callback's sync is intentionally non-fatal, so a database outage
 * at that moment must not leave a signed-in account permanently unable to own
 * drawings. Everything that owns data keys off `DbUser.id` rather than the
 * WorkOS id, so rows are not coupled to the identity provider.
 */
const toDbUser = async (workosUser: User): Promise<DbUser> => {
  const [existing] = await getDb()
    .select()
    .from(users)
    .where(eq(users.workosId, workosUser.id))
    .limit(1)

  return existing ?? await syncUser(workosUser)
}

/** For pages: redirects to sign-in when there is no session. */
const requireDbUser = async (): Promise<DbUser> => toDbUser(await requireAuth())

/**
 * For route handlers: returns null instead of redirecting, so the caller can
 * answer 401. `requireAuth` would emit a redirect, which is the wrong response
 * shape for an API client.
 */
const getDbUser = async (): Promise<DbUser | null> => {
  const workosUser = await getCurrentUser()

  return workosUser ? toDbUser(workosUser) : null
}

export { getDbUser, requireDbUser }
