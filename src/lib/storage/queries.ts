import "server-only"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { type DbStorageCredentials, storageCredentials } from "@/db/schema"
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto/secret-box"
import type { StorageConfig } from "@/lib/storage/client"
import { isStorageProvider } from "@/lib/storage/providers"

/** Safe to send to the browser: identifies the configuration without exposing it. */
type StorageSettingsView = {
  provider: string
  endpoint: string
  region: string
  bucket: string
  accessKeyIdMasked: string
  publicBaseUrl: string | null
  updatedAt: Date
}

type StorageInput = {
  provider: string
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl: string | null
}

const getRow = async (userId: string): Promise<DbStorageCredentials | undefined> => {
  const [row] = await getDb()
    .select()
    .from(storageCredentials)
    .where(eq(storageCredentials.userId, userId))
    .limit(1)

  return row
}

/**
 * Decrypted credentials for server-side use only.
 *
 * Returns null when unconfigured — callers treat that as "no object storage",
 * which is a supported state, not an error.
 */
const getStorageConfig = async (userId: string): Promise<StorageConfig | null> => {
  const row = await getRow(userId)

  if (!row || !isStorageProvider(row.provider)) {
    return null
  }

  return {
    provider: row.provider,
    endpoint: row.endpoint,
    region: row.region,
    bucket: row.bucket,
    accessKeyId: decryptSecret(row.accessKeyIdEncrypted),
    secretAccessKey: decryptSecret(row.secretAccessKeyEncrypted),
    publicBaseUrl: row.publicBaseUrl,
  }
}

/** The view rendered in settings. Secrets never leave the server. */
const getStorageSettings = async (userId: string): Promise<StorageSettingsView | null> => {
  const row = await getRow(userId)

  if (!row) {
    return null
  }

  return {
    provider: row.provider,
    endpoint: row.endpoint,
    region: row.region,
    bucket: row.bucket,
    accessKeyIdMasked: maskSecret(decryptSecret(row.accessKeyIdEncrypted)),
    publicBaseUrl: row.publicBaseUrl,
    updatedAt: row.updatedAt,
  }
}

const saveStorageSettings = async (userId: string, input: StorageInput): Promise<void> => {
  const values = {
    userId,
    provider: input.provider,
    endpoint: input.endpoint,
    region: input.region,
    bucket: input.bucket,
    accessKeyIdEncrypted: encryptSecret(input.accessKeyId),
    secretAccessKeyEncrypted: encryptSecret(input.secretAccessKey),
    publicBaseUrl: input.publicBaseUrl,
  }

  await getDb()
    .insert(storageCredentials)
    .values(values)
    .onConflictDoUpdate({
      target: storageCredentials.userId,
      set: { ...values, updatedAt: new Date() },
    })
}

const deleteStorageSettings = async (userId: string): Promise<void> => {
  await getDb().delete(storageCredentials).where(eq(storageCredentials.userId, userId))
}

export { deleteStorageSettings, getStorageConfig, getStorageSettings, saveStorageSettings }
export type { StorageInput, StorageSettingsView }
