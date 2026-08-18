import { NextResponse } from "next/server"
import { getAccountUser, isAdmin } from "@/lib/auth/current-user"
import { inviteUser } from "@/lib/users/queries"

/** Deliberately loose — real validation is that the invitee can sign in with it. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Pre-approves an email that has never signed in.
 *
 * The row it creates carries no WorkOS identity; the invitee's first sign-in
 * claims it by email and inherits the approved status.
 */
export const POST = async (request: Request): Promise<Response> => {
  const actor = await getAccountUser()

  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  if (!isAdmin(actor)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const body = await request.json().catch(() => null) as { email?: unknown } | null
  const email = typeof body?.email === "string" ? body.email.trim() : ""

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  }

  const invited = await inviteUser(email, actor.id)

  // Already known. Refused rather than silently reset: re-inviting someone who
  // was declined or banned must not be a back door to approving them.
  if (!invited) {
    return NextResponse.json({ error: "already_exists" }, { status: 409 })
  }

  return NextResponse.json({ id: invited.id, email: invited.email }, { status: 201 })
}
