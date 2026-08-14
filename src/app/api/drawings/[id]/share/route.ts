import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { getShareState, revokeSharing, setSharing } from "@/lib/drawings/queries"

type Context = { params: Promise<{ id: string }> }

/**
 * Owner-side control of a drawing's share link.
 *
 * Every handler is user-scoped like the rest of the drawing routes, so a drawing
 * belonging to someone else answers 404 — nobody but the owner can mint, read or
 * revoke a link. The token itself is only ever returned here, never in the list
 * payload.
 */
const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 })
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 })

export const GET = async (_request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const state = await getShareState(user.id, (await params).id)

  return state ? NextResponse.json(state) : notFound()
}

export const POST = async (request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const body = await request.json().catch(() => null) as { rotate?: unknown } | null
  const rotate = body?.rotate === true

  const state = await setSharing(user.id, (await params).id, { rotate })

  return state ? NextResponse.json(state) : notFound()
}

export const DELETE = async (_request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const revoked = await revokeSharing(user.id, (await params).id)

  return revoked ? NextResponse.json({ shareToken: null, sharedAt: null }) : notFound()
}
