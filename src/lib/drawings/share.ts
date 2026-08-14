/**
 * Share tokens.
 *
 * A token is a bearer credential: holding it is the entire authorisation to read
 * one drawing. It is therefore sized so that guessing is not a threat worth
 * engineering against — 32 random bytes, about 256 bits.
 *
 * Deliberately free of server-only imports. The browser needs `shareLinkPath` to
 * build a copyable link, so this module uses Web Crypto rather than `node:crypto`
 * and stays usable from both sides.
 */

const TOKEN_BYTES = 32

/** Length of a base64url encoding of `TOKEN_BYTES`, unpadded. */
const TOKEN_LENGTH = Math.ceil((TOKEN_BYTES * 8) / 6)

/** base64url so the token drops into a path segment with no escaping. */
const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const createShareToken = (): string =>
  toBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)))

/**
 * Rejects anything that cannot be a token before it reaches the database.
 *
 * Not a security control — the lookup is exact either way — but it keeps
 * malformed paths from becoming queries.
 */
const isShareTokenShaped = (value: string): boolean =>
  value.length === TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(value)

/**
 * The path half of a share link.
 *
 * Only the path: the origin is joined on in the browser from
 * `window.location.origin`. The server has no dependable public origin to use —
 * the one absolute URL it knows is the WorkOS redirect URI, and building share
 * links out of the auth configuration would couple the two for no reason.
 */
const shareLinkPath = (token: string): string => `/s/${token}`

export { createShareToken, isShareTokenShaped, shareLinkPath, TOKEN_LENGTH }
