import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { duplicateDrawing } from "@/lib/drawings/queries"

type Context = { params: Promise<{ id: string }> }

/**
 * Copies a drawing into a new one of the same account.
 *
 * The copy is made server-side from the stored row rather than from anything the
 * client sends, so duplicating cannot be used to write an arbitrary document, and
 * the user-scoped read means an id belonging to someone else answers 404 like any
 * other missing drawing.
 */
export const POST = async (_request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const drawing = await duplicateDrawing(user.id, (await params).id)

  return drawing
    ? NextResponse.json({ drawing }, { status: 201 })
    : NextResponse.json({ error: "not_found" }, { status: 404 })
}
