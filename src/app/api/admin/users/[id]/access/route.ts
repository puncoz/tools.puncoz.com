import { NextResponse } from "next/server"
import { ACCESS_STATUSES, type AccessStatus } from "@/db/schema"
// Admin pages are one of only three places allowed to reach a non-approved user:
// reviewing people necessarily means loading people who are not approved.
import { getAccountUser, isAdmin } from "@/lib/auth/current-user"
import { setAccessStatus } from "@/lib/users/queries"

type Context = { params: Promise<{ id: string }> }

const MAX_NOTE_LENGTH = 1000

const isAccessStatus = (value: unknown): value is AccessStatus =>
  typeof value === "string" && (ACCESS_STATUSES as readonly string[]).includes(value)

/**
 * Moves one user to a new access status.
 *
 * Guarded here as well as on the page. A page guard protects the screen; this
 * protects the capability, and it is the one an attacker would reach for.
 */
export const POST = async (request: Request, { params }: Context): Promise<Response> => {
  const actor = await getAccountUser()

  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // 404 rather than 403: a non-admin learns nothing about what lives here.
  if (!isAdmin(actor)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const { id } = await params

  // An admin who bans themselves would lock the only account that can unban
  // anyone out of the screen that does it.
  if (id === actor.id) {
    return NextResponse.json({ error: "cannot_change_own_access" }, { status: 409 })
  }

  const body = await request.json().catch(() => null) as
    { status?: unknown, note?: unknown } | null

  if (!isAccessStatus(body?.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 })
  }

  const note = typeof body?.note === "string"
    ? body.note.trim().slice(0, MAX_NOTE_LENGTH) || null
    : null

  const updated = await setAccessStatus({
    userId: id,
    status: body.status,
    note,
    actorId: actor.id,
    source: "admin",
  })

  return updated
    ? NextResponse.json({ id: updated.id, accessStatus: updated.accessStatus })
    : NextResponse.json({ error: "not_found" }, { status: 404 })
}
