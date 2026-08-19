import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { MAX_DOCUMENT_BYTES, documentByteSize } from "@/lib/drawings/limits"
import { deleteDrawing, getDrawing, renameDrawing, saveDocument, saveThumbnail } from "@/lib/drawings/queries"
import { parseThumbnail } from "@/lib/drawings/thumbnail"

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

/**
 * Renames a drawing, sets its gallery previews, or both.
 *
 * Title and previews are written by separate queries on purpose: a rename is a
 * user edit and bumps `updatedAt`, a preview is not and must not. Sending both
 * in one request is allowed but is not something the UI currently does.
 *
 * The two preview variants, by contrast, are written together in one query.
 * They share a single `thumbnailUpdatedAt`, which is also the cache buster on
 * their URL, so writing them apart would let the pair disagree about its age and
 * serve one stale variant under a key that says otherwise.
 */
export const PATCH = async (request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const body = await request.json().catch(() => null) as
    { title?: unknown, thumbnail?: unknown, thumbnailDark?: unknown } | null

  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const hasTitle = body.title !== undefined
  const hasThumbnail = body.thumbnail !== undefined

  if (!hasTitle && !hasThumbnail) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 })
  }

  const { id } = await params

  if (hasThumbnail) {
    // null clears the preview — sent when the last shape is deleted, so the card
    // falls back to its placeholder instead of showing what used to be there.
    if (body.thumbnail !== null && parseThumbnail(body.thumbnail) === null) {
      return NextResponse.json({ error: "invalid_thumbnail" }, { status: 400 })
    }

    // The dark variant is optional and validated the same way. Absent or null
    // means "no dark render this time" — the serving route then falls back to
    // the light bytes — so a client that only manages one variant still works.
    const dark = body.thumbnailDark ?? null

    if (dark !== null && parseThumbnail(dark) === null) {
      return NextResponse.json({ error: "invalid_thumbnail" }, { status: 400 })
    }

    const thumbnailUpdatedAt = await saveThumbnail(
      user.id,
      id,
      body.thumbnail as string | null,
      dark as string | null,
    )

    if (thumbnailUpdatedAt === undefined) {
      return notFound()
    }

    if (!hasTitle) {
      return NextResponse.json({ thumbnailUpdatedAt })
    }
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : ""

  if (title.length === 0) {
    return NextResponse.json({ error: "title_required" }, { status: 400 })
  }

  const drawing = await renameDrawing(user.id, id, title)

  return drawing ? NextResponse.json({ drawing }) : notFound()
}

/**
 * Moves a drawing to the trash. Nothing is destroyed here — restoring it and
 * removing it for good both live at `[id]/trash`.
 */
export const DELETE = async (_request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const deleted = await deleteDrawing(user.id, (await params).id)

  return deleted ? NextResponse.json({ ok: true }) : notFound()
}
