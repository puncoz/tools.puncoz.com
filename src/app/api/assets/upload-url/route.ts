import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import {
  ALLOWED_CONTENT_TYPE,
  MAX_ASSET_BYTES,
  assetSrcFromKey,
  buildAssetKey,
  extensionFor,
} from "@/lib/storage/asset-key"
import { presignUpload } from "@/lib/storage/client"
import { getStorageConfig } from "@/lib/storage/queries"

/**
 * Mints a presigned PUT so the browser uploads straight to the user's bucket.
 *
 * The file itself never passes through here — Vercel caps function bodies at
 * 4.5 MB, which most images would exceed once base64-encoded.
 */
export const POST = async (request: Request): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const config = await getStorageConfig(user.id)

  if (!config) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 409 })
  }

  const body = await request.json().catch(() => null) as
    { contentType?: unknown, fileName?: unknown, size?: unknown } | null

  const contentType = typeof body?.contentType === "string" ? body.contentType : ""

  if (!ALLOWED_CONTENT_TYPE.test(contentType)) {
    return NextResponse.json({ error: "unsupported_content_type" }, { status: 400 })
  }

  if (typeof body?.size === "number" && body.size > MAX_ASSET_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", limit: MAX_ASSET_BYTES },
      { status: 413 },
    )
  }

  // The key is server-generated: a client-supplied path could target another
  // user's namespace or overwrite an existing object.
  const extension = extensionFor(typeof body?.fileName === "string" ? body.fileName : "")
  const key = buildAssetKey(user.id, randomUUID(), extension)

  const uploadUrl = await presignUpload(config, key, contentType)

  return NextResponse.json({
    uploadUrl,
    // A public bucket yields a permanent URL; otherwise the document stores the
    // key and a signed URL is minted per render.
    src: config.publicBaseUrl
      ? `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`
      : assetSrcFromKey(key),
  })
}
