import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { assetKeyPrefix } from "@/lib/storage/asset-key"
import { presignDownload } from "@/lib/storage/client"
import { getStorageConfig } from "@/lib/storage/queries"

/**
 * Mints a short-lived signed GET URL for a privately stored asset.
 *
 * Called at render time rather than baked into the document, because a signed
 * URL stored in the document would expire and break the image.
 */
export const GET = async (request: Request): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const key = new URL(request.url).searchParams.get("key") ?? ""

  // Keys are namespaced per user; without this check any signed-in user could
  // mint a URL for another user's object by guessing a key.
  if (!key.startsWith(assetKeyPrefix(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const config = await getStorageConfig(user.id)

  if (!config) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 409 })
  }

  return NextResponse.json({ url: await presignDownload(config, key) })
}
