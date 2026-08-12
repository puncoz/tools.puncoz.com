import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { createDrawing, listDrawings } from "@/lib/drawings/queries"

export const GET = async (): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ drawings: await listDrawings(user.id) })
}

export const POST = async (request: Request): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { title?: unknown, document?: unknown }
  const title = typeof body.title === "string" && body.title.trim().length > 0
    ? body.title.trim().slice(0, 200)
    : undefined

  const drawing = await createDrawing(user.id, { title, document: body.document ?? {} })

  return NextResponse.json({ drawing }, { status: 201 })
}
