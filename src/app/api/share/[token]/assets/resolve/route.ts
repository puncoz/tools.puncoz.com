import { NextResponse } from "next/server"
import { getDrawingByShareToken } from "@/lib/drawings/queries"
import { isShareTokenShaped } from "@/lib/drawings/share"
import { assetKeyPrefix } from "@/lib/storage/asset-key"
import { presignDownload } from "@/lib/storage/client"
import { getStorageConfig } from "@/lib/storage/queries"
import { assetKeysInDocument } from "@/lib/tldraw/document-assets"

type Context = { params: Promise<{ token: string }> }

/**
 * Mints a signed URL for an image inside a shared drawing.
 *
 * The public counterpart to `/api/assets/resolve`. That route authenticates a
 * session and scopes keys to that user; this one has no session at all, so the
 * token does the authenticating and two checks do the scoping:
 *
 *  1. the key sits under the OWNER's prefix — not the caller's, there is no
 *     caller — so a token can never reach another account's bucket; and
 *  2. the key is actually referenced by this drawing's document.
 *
 * The second check is what confines a token to the drawing it was issued for.
 * Without it, a link to one drawing would resolve any object the owner had
 * stored, including from drawings that were never shared. Keys are UUIDs, so
 * guessing one is impractical — but "not in this document" is a guarantee, and
 * "hard to guess" is only an obstacle.
 */
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 })

export const GET = async (request: Request, { params }: Context): Promise<Response> => {
  const { token } = await params

  if (!isShareTokenShaped(token)) {
    return notFound()
  }

  const drawing = await getDrawingByShareToken(token)

  if (!drawing) {
    return notFound()
  }

  const key = new URL(request.url).searchParams.get("key") ?? ""

  if (!key.startsWith(assetKeyPrefix(drawing.userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  if (!assetKeysInDocument(drawing.document).has(key)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const config = await getStorageConfig(drawing.userId)

  if (!config) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 409 })
  }

  return NextResponse.json({ url: await presignDownload(config, key) })
}
