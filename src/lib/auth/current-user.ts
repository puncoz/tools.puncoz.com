import "server-only"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { cache } from "react"
import { getDb } from "@/db"
import { type DbUser, users } from "@/db/schema"
import { canUseTools } from "@/lib/auth/access"
import { getCurrentUser, requireAuth } from "@/lib/auth/session"
import { isAdminEmail, syncUser } from "@/lib/auth/sync-user"
import type { User } from "@workos-inc/node"

/**
 * The access choke point.
 *
 * SECURITY: `getDbUser` and `requireDbUser` return ONLY approved users. Every
 * page and route handler in the app goes through one of them, so gating here
 * rather than per-route means each of the fourteen existing API call sites — and
 * every one written in future — is closed by default. Gating the `(tools)`
 * layout instead would be theatre: a pending user holds a perfectly valid
 * session and could call `/api/drawings` directly.
 *
 * Reaching a non-approved user requires `getAccountUser`, and exactly three
 * places may: `/account`, `/admin/**`, and `POST /api/account/reapply`. Anything
 * else using it is a bug.
 */

/**
 * The lookup half of `toDbUser`, deduped for the lifetime of one request.
 *
 * The `(tools)` layout and the page inside it both call `requireDbUser`, so
 * without this every authenticated render pays for the identical lookup more
 * than once — and in production the database is a round trip away rather than
 * next door (ADR 0005). Measured at five lookups per navigation before this,
 * one after.
 *
 * Keyed on the WorkOS id rather than on the user object because `cache()`
 * compares arguments by identity, and AuthKit's `withAuth()` unseals the cookie
 * into a fresh object on every call — an object key would never hit.
 *
 * Per request, not across them: two users can never see each other's row.
 */
const findByWorkosId = cache(async (workosId: string): Promise<DbUser | undefined> => {
  const [existing] = await getDb()
    .select()
    .from(users)
    .where(eq(users.workosId, workosId))
    .limit(1)

  return existing
})

/**
 * Resolves a WorkOS user to its local row, creating it if absent.
 *
 * The sign-in callback's sync is intentionally non-fatal, so a database outage
 * at that moment must not leave a signed-in account permanently unable to own
 * drawings. Everything that owns data keys off `DbUser.id` rather than the
 * WorkOS id, so rows are not coupled to the identity provider.
 */
const toDbUser = async (workosUser: User): Promise<DbUser> =>
  await findByWorkosId(workosUser.id) ?? await syncUser(workosUser)

/**
 * The signed-in user whatever their access status.
 *
 * Named to be conspicuous at the call site: it is the bypass, and reviewing a
 * diff that adds one should prompt the question "should this be reachable
 * without approval?".
 */
const getAccountUser = async (): Promise<DbUser | null> => {
  const workosUser = await getCurrentUser()

  return workosUser ? toDbUser(workosUser) : null
}

/** For pages that must render for any signed-in user, approved or not. */
const requireAccountUser = async (): Promise<DbUser> => toDbUser(await requireAuth())

/**
 * For pages: redirects to sign-in when there is no session, and to `/account`
 * when there is one without approval — where the reason is explained.
 */
const requireDbUser = async (): Promise<DbUser> => {
  const user = await requireAccountUser()

  if (!canUseTools(user)) {
    redirect("/account")
  }

  return user
}

/**
 * For route handlers: returns null instead of redirecting, so the caller can
 * answer 401. `requireAuth` would emit a redirect, which is the wrong response
 * shape for an API client.
 *
 * A non-approved user is null here too, so they are indistinguishable from a
 * signed-out one — the right amount to leak to an API client.
 */
const getDbUser = async (): Promise<DbUser | null> => {
  const user = await getAccountUser()

  return user && canUseTools(user) ? user : null
}

const isAdmin = (user: DbUser): boolean => isAdminEmail(user.email)

/** For the admin pages: 404 rather than redirect, so the route's existence leaks nothing. */
const requireAdmin = async (): Promise<DbUser> => {
  const user = await requireAccountUser()

  if (!isAdmin(user)) {
    redirect("/account")
  }

  return user
}

export { getAccountUser, getDbUser, isAdmin, requireAccountUser, requireAdmin, requireDbUser }
