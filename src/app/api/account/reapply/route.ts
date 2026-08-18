import { NextResponse } from "next/server"
// One of only three places allowed to reach a non-approved user: a declined user
// is by definition not approved, and this is how they ask to be reconsidered.
import { getAccountUser } from "@/lib/auth/current-user"
import { canReapply, reapplyAvailableAt } from "@/lib/auth/access"
import { setAccessStatus } from "@/lib/users/queries"

const MAX_MESSAGE_LENGTH = 1000

/**
 * Returns a declined user to `pending` with a message for the admin.
 *
 * Both conditions are re-checked here rather than trusted from the UI: the page
 * hides the form when it should, but the form is not the control — a client can
 * post whatever it likes.
 */
export const POST = async (request: Request): Promise<Response> => {
  const user = await getAccountUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  if (user.accessStatus !== "declined") {
    return NextResponse.json({ error: "not_declined" }, { status: 409 })
  }

  const availableAt = reapplyAvailableAt(user)

  if (!canReapply(user)) {
    return NextResponse.json(
      { error: "cooldown", availableAt: availableAt?.toISOString() ?? null },
      { status: 429 },
    )
  }

  const body = await request.json().catch(() => null) as { message?: unknown } | null
  const message = typeof body?.message === "string"
    ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH)
    : ""

  if (message.length === 0) {
    return NextResponse.json({ error: "message_required" }, { status: 400 })
  }

  const updated = await setAccessStatus({
    userId: user.id,
    status: "pending",
    note: message,
    actorId: user.id,
    source: "self",
  })

  return updated
    ? NextResponse.json({ accessStatus: updated.accessStatus })
    : NextResponse.json({ error: "not_found" }, { status: 404 })
}
