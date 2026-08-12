import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "@/db/schema/users"

/**
 * A user's own object storage, used to keep image assets out of drawing
 * documents.
 *
 * One row per user. All three supported providers speak the S3 API — Supabase
 * Storage and Cloudflare R2 both expose S3-compatible endpoints — so `provider`
 * only drives endpoint defaults and the hints shown in settings, not a
 * different client.
 *
 * The two secret columns hold AES-256-GCM ciphertext and are never returned to
 * the browser.
 */
export const storageCredentials = pgTable("storage_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  endpoint: text("endpoint").notNull(),
  region: text("region").notNull(),
  bucket: text("bucket").notNull(),
  accessKeyIdEncrypted: text("access_key_id_encrypted").notNull(),
  secretAccessKeyEncrypted: text("secret_access_key_encrypted").notNull(),
  /**
   * Optional. When set, uploads return a permanent public URL. When absent,
   * assets are stored by key and a short-lived signed URL is minted on each
   * render, which keeps the bucket private.
   */
  publicBaseUrl: text("public_base_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type DbStorageCredentials = typeof storageCredentials.$inferSelect
export type NewDbStorageCredentials = typeof storageCredentials.$inferInsert
