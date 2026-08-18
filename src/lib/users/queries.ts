import "server-only"
import { desc, eq, getTableColumns, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
  type AccessEventSource,
  type AccessStatus,
  type DbUser,
  userAccessEvents,
  users,
} from "@/db/schema"
import { normaliseEmail } from "@/lib/auth/sync-user"

/**
 * Reads and writes for the access lifecycle.
 *
 * Every status change goes through `setAccessStatus`, which is also what appends
 * the event. Keeping the two together means there is no way to move a user
 * without leaving a record — a second function that only wrote the column would
 * eventually be the one somebody called.
 */

/** A user plus the message from their most recent reapply, if any. */
type UserForReview = DbUser & { reapplyMessage: string | null }

/**
 * Everyone, with the latest reapply message attached.
 *
 * The message is pulled from the event log rather than the user row because
 * `accessNote` belongs to the reviewer — see `setAccessStatus`. Without it an
 * admin would see that somebody had reapplied but not what they said, which is
 * the one thing needed to decide.
 */
const listUsers = async (): Promise<UserForReview[]> =>
  getDb()
    .select({
      ...getTableColumns(users),
      // Table names are written out rather than interpolated from the schema.
      // Drizzle renders an interpolated column unqualified — `"user_id" = "id"`
      // — and inside a correlated subquery the inner table shadows the outer, so
      // that compares `user_access_events.user_id` to its own `id` and silently
      // matches nothing. The alias makes both sides unambiguous.
      reapplyMessage: sql<string | null>`(
        select e.note
        from user_access_events e
        where e.user_id = "users"."id" and e.source = 'self'
        order by e.created_at desc
        limit 1
      )`,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

const getUserById = async (id: string): Promise<DbUser | undefined> => {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1)

  return row
}

const listAccessEvents = async (userId: string) =>
  getDb()
    .select()
    .from(userAccessEvents)
    .where(eq(userAccessEvents.userId, userId))
    .orderBy(desc(userAccessEvents.createdAt))

/**
 * Moves a user to a new status and records why.
 *
 * Returns undefined when the user does not exist. A transition to the status the
 * user already holds is still recorded: "approved again" is a real thing an
 * admin can do, and silently dropping it would make the log lie.
 */
const setAccessStatus = async ({
  userId,
  status,
  note,
  actorId,
  source,
}: {
  userId: string
  status: AccessStatus
  note?: string | null
  actorId?: string | null
  source: AccessEventSource
}): Promise<DbUser | undefined> => {
  const db = getDb()
  const current = await getUserById(userId)

  if (!current) {
    return undefined
  }

  const [row] = await db
    .update(users)
    .set({
      accessStatus: status,
      accessReviewedAt: new Date(),
      accessReviewedBy: actorId ?? null,
      updatedAt: new Date(),
      // `accessNote` is what the USER reads on /account, so only a reviewer may
      // write it. A reapply's note is the user's own message: putting it here
      // would quote their words back at them as though they were the decision's
      // reason. It lives in the event log instead, and the admin table reads it
      // from there.
      ...(source === "self" ? {} : { accessNote: note ?? null }),
      // Stamped only when the user is the one asking, so the cooldown measures
      // time since their last attempt rather than since any admin action.
      ...(source === "self" ? { lastReappliedAt: new Date() } : {}),
    })
    .where(eq(users.id, userId))
    .returning()

  await db.insert(userAccessEvents).values({
    userId,
    fromStatus: current.accessStatus,
    toStatus: status,
    note: note ?? null,
    actorId: actorId ?? null,
    source,
  })

  return row
}

/**
 * Pre-approves an email that has never signed in.
 *
 * Creates a row with no `workosId`; the invitee's first sign-in claims it by
 * email and inherits the approved status. Returns undefined if the address is
 * already known, so inviting an existing user is a no-op rather than a way to
 * silently reset their status.
 */
const inviteUser = async (
  email: string,
  actorId: string,
): Promise<DbUser | undefined> => {
  const db = getDb()
  const normalised = normaliseEmail(email)

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalised))
    .limit(1)

  if (existing) {
    return undefined
  }

  const [row] = await db
    .insert(users)
    .values({
      email: normalised,
      accessStatus: "approved",
      accessReviewedAt: new Date(),
      accessReviewedBy: actorId,
    })
    .returning()

  await db.insert(userAccessEvents).values({
    userId: row.id,
    fromStatus: "pending",
    toStatus: "approved",
    note: "Invited by email",
    actorId,
    source: "admin",
  })

  return row
}

export { getUserById, inviteUser, listAccessEvents, listUsers, setAccessStatus }
export type { UserForReview }
