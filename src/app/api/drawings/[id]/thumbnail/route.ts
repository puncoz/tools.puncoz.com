import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { getThumbnail } from "@/lib/drawings/queries"
import { parseThumbnail } from "@/lib/drawings/thumbnail"

type Context = { params: Promise<{ id: string }> }

/**
 * Serves a drawing's gallery preview as image bytes.
 *
 * The preview is stored as a data URL, but inlining those into the gallery's HTML
 * would mean megabytes of base64 markup re-sent on every render. Cards point here
 * instead, so previews are ordinary images the browser caches.
 *
 * Callers pass `?v={thumbnailUpdatedAt}` as a cache key. It must come from
 * `thumbnailUpdatedAt` and not `updatedAt`, since a preview write deliberately
 * leaves `updatedAt` alone. The value is never read here; it only has to change
 * when the preview does.
 *
 * CAVEAT: the `Cache-Control` below does not currently take effect. AuthKit's
 * proxy overwrites it with `no-store` on every response it touches, and the route
 * cannot be excluded from the proxy — `withAuth` throws on any path the proxy
 * does not cover. So previews are refetched on each gallery visit. They are only
 * a few kilobytes each, which is why this is acceptable rather than blocking; the
 * header and the cache key stay so that caching starts working by itself if that
 * behaviour ever changes, or if a CDN is put in front.
 */
export const GET = async (_request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const row = await getThumbnail(user.id, (await params).id)

  // A drawing owned by someone else, a drawing that does not exist, and a drawing
  // with no preview yet are all the same 404 — ids appear in URLs and are not
  // secret, so none of them may be distinguishable.
  if (!row?.thumbnail) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  // Re-parsed rather than trusted: the `Content-Type` below is what decides how a
  // browser renders these bytes, so it comes from the validator, not the column.
  const parsed = parseThumbnail(row.thumbnail)

  if (!parsed) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return new Response(Buffer.from(parsed.base64, "base64"), {
    headers: {
      "content-type": parsed.mime,
      // `private` because these are one user's drawings and must never be held by
      // a shared cache.
      "cache-control": "private, max-age=31536000, immutable",
    },
  })
}
