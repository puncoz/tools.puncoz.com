import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { requireEnv } from "@/config/env"

/**
 * Authenticated encryption for credentials at rest.
 *
 * AES-256-GCM rather than plain AES: GCM authenticates the ciphertext, so a
 * tampered row fails to decrypt instead of yielding attacker-influenced
 * plaintext.
 *
 * Stored format is `v1.<iv>.<authTag>.<ciphertext>`, all base64url. The version
 * prefix means the scheme can be changed later without guessing at old rows.
 */

const ALGORITHM = "aes-256-gcm"
const VERSION = "v1"
const IV_BYTES = 12
const KEY_BYTES = 32

let cachedKey: Buffer | undefined

/**
 * Read lazily rather than at import so a deployment without the key still
 * builds and boots — only storage settings become unusable.
 */
const getKey = (): Buffer => {
  if (cachedKey) {
    return cachedKey
  }

  const key = Buffer.from(requireEnv("CREDENTIALS_ENCRYPTION_KEY"), "base64")

  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}. `
      + "Generate one with: openssl rand -base64 32",
    )
  }

  cachedKey = key

  return key
}

const encryptSecret = (plaintext: string): string => {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])

  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

const decryptSecret = (payload: string): string => {
  const parts = payload.split(".")
  const [version, iv, authTag, ciphertext] = parts

  // Checked by arity and presence rather than truthiness: an empty plaintext
  // encrypts to an empty ciphertext segment, which is valid.
  if (parts.length !== 4 || version !== VERSION || !iv || !authTag || ciphertext === undefined) {
    throw new Error("Stored secret is malformed or uses an unknown format.")
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64url"))

  decipher.setAuthTag(Buffer.from(authTag, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

/** Last four characters only, for showing which key is configured. */
const maskSecret = (plaintext: string): string =>
  plaintext.length <= 4 ? "••••" : `••••${plaintext.slice(-4)}`

export { decryptSecret, encryptSecret, maskSecret }
