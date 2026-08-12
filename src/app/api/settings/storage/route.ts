import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { testConnection } from "@/lib/storage/client"
import { isStorageProvider } from "@/lib/storage/providers"
import { deleteStorageSettings, getStorageSettings, saveStorageSettings } from "@/lib/storage/queries"

const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 })

export const GET = async (): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  return NextResponse.json({ settings: await getStorageSettings(user.id) })
}

/**
 * Saves credentials, but only after they are proven to work.
 *
 * Testing before writing means a typo surfaces here rather than as a broken
 * image later, and avoids storing credentials that were never valid.
 */
export const PUT = async (request: Request): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const text = (key: string): string => typeof body?.[key] === "string" ? (body[key] as string).trim() : ""

  const provider = text("provider")
  const bucket = text("bucket")
  const region = text("region")
  const endpoint = text("endpoint")
  const accessKeyId = text("accessKeyId")
  const secretAccessKey = text("secretAccessKey")
  const publicBaseUrl = text("publicBaseUrl")

  if (!isStorageProvider(provider)) {
    return NextResponse.json({ error: "invalid_provider" }, { status: 400 })
  }

  const missing = Object.entries({ bucket, region, accessKeyId, secretAccessKey })
    .filter(([, value]) => value.length === 0)
    .map(([field]) => field)

  if (missing.length > 0) {
    return NextResponse.json({ error: "missing_fields", fields: missing }, { status: 400 })
  }

  const config = {
    provider,
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: publicBaseUrl || null,
  }

  const result = await testConnection(config)

  if (!result.ok) {
    return NextResponse.json({ error: "connection_failed", message: result.error }, { status: 400 })
  }

  try {
    await saveStorageSettings(user.id, config)
  } catch (error) {
    // Almost always a missing or malformed CREDENTIALS_ENCRYPTION_KEY, which
    // deserves a message rather than a generic 500.
    return NextResponse.json(
      { error: "save_failed", message: error instanceof Error ? error.message : "Could not save" },
      { status: 500 },
    )
  }

  return NextResponse.json({ settings: await getStorageSettings(user.id) })
}

export const DELETE = async (): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return unauthorized()
  }

  await deleteStorageSettings(user.id)

  return NextResponse.json({ ok: true })
}
