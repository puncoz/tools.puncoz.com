import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { MAX_DOCUMENT_BYTES, documentByteSize } from "@/lib/drawings/limits"
import { deleteDrawing, getDrawing, renameDrawing, saveDocument } from "@/lib/drawings/queries"

type Context = { params: Promise<{ id: string }> }

/**
 * Every handler resolves the user from the session and passes the id through to
 * a user-scoped query. A drawing that belongs to someone else is indistinguishable
 * from one that does not exist — both answer 404, so ids cannot be probed.
 */
const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 })
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 })

export const GET = async (_request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const drawing = await getDrawing(user.id, (await params).id)

  return drawing ? NextResponse.json({ drawing }) : notFound()
}

export const PUT = async (request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const body = await request.json().catch(() => null) as { document?: unknown } | null

  if (!body || body.document === undefined) {
    return NextResponse.json({ error: "document_required" }, { status: 400 })
  }

  // Rejected here with a clear code rather than letting the platform answer an
  // opaque 413 at the edge.
  const size = documentByteSize(body.document)

  if (size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json(
      { error: "document_too_large", size, limit: MAX_DOCUMENT_BYTES },
      { status: 413 },
    )
  }

  const drawing = await saveDocument(user.id, (await params).id, body.document)

  return drawing
    ? NextResponse.json({ updatedAt: drawing.updatedAt })
    : notFound()
}

export const PATCH = async (request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const body = await request.json().catch(() => null) as { title?: unknown } | null
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : ""

  if (title.length === 0) {
    return NextResponse.json({ error: "title_required" }, { status: 400 })
  }

  const drawing = await renameDrawing(user.id, (await params).id, title)

  return drawing ? NextResponse.json({ drawing }) : notFound()
}

export const DELETE = async (_request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const deleted = await deleteDrawing(user.id, (await params).id)

  return deleted ? NextResponse.json({ ok: true }) : notFound()
}
