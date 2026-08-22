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
 * when the preview does. One key covers both variants — they are rendered and
 * written in the same pass, so they never disagree about their age.
 *
 * `?theme=dark` asks for the preview rendered in tldraw's dark theme, falling
 * back to the light bytes when there is no dark variant. That fallback is the
 * whole reason this is not a 404: every drawing made before the dark column
 * existed has only a light preview until it is next opened, and a gallery of
 * broken images would be a far worse answer than a gallery of light ones.
 *
 * The `Cache-Control` below takes effect, and this comment used to say it did
 * not — that AuthKit's proxy overwrote it with `no-store` on every response it
 * touched, so previews were refetched on every gallery visit. Measured against
 * production, the header now arrives at the browser intact. `authkit-nextjs@4`
 * exports `setCachePreventionHeaders` but never calls it, and sets
 * `cache-control` in only one place — when it is itself setting a cookie and
 * none is present (`middleware-helpers.js`). The blanket
 * `private, no-cache, no-store, max-age=0, must-revalidate` still seen on HTML
 * documents is Next's own default for a dynamic render, not the proxy's. See
 * ADR 0008.
 *
 * So repeat visits are served from disk. What is *not* cheap is the first fetch:
 * measured at ~2s for ~9KB, essentially all of it function invocation, session
 * unsealing and a database read rather than bytes on the wire. That is why the
 * gallery hints the first row at high priority, and it is the reason to be
 * careful about how many of these a page fires at once.
 */
export const GET = async (request: Request, { params }: Context): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const wantsDark = new URL(request.url).searchParams.get("theme") === "dark"
  const row = await getThumbnail(user.id, (await params).id)

  // A drawing owned by someone else, a drawing that does not exist, and a drawing
  // with no preview yet are all the same 404 — ids appear in URLs and are not
  // secret, so none of them may be distinguishable.
  if (!row?.thumbnail) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const bytes = wantsDark ? row.thumbnailDark ?? row.thumbnail : row.thumbnail

  // Re-parsed rather than trusted: the `Content-Type` below is what decides how a
  // browser renders these bytes, so it comes from the validator, not the column.
  const parsed = parseThumbnail(bytes)

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
