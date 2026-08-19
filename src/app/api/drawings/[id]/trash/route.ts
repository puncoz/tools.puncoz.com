import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { purgeDrawing, restoreDrawing } from "@/lib/drawings/queries"

type Context = { params: Promise<{ id: string }> }

/**
 * What can be done to a drawing once it is in the trash.
 *
 * Moving it there is `DELETE /api/drawings/[id]` — the ordinary delete, which is
 * now soft. The two handlers here are the way back out and the way past the
 * point of no return, and both refuse to touch a live drawing: their queries are
 * scoped to rows that are already trashed, so the destructive one cannot be
 * pointed at something the user is still using, whatever id it is given.
 */
const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 })
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 })

/** Restores a trashed drawing. */
export const POST = async (_request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const drawing = await restoreDrawing(user.id, (await params).id)

  return drawing ? NextResponse.json({ drawing }) : notFound()
}

/** Deletes a trashed drawing for good. This one really does remove the row. */
export const DELETE = async (_request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const purged = await purgeDrawing(user.id, (await params).id)

  return purged ? NextResponse.json({ ok: true }) : notFound()
}
