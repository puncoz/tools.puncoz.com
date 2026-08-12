/**
 * How an uploaded asset is referenced from inside a tldraw document.
 *
 * When the bucket is public, `src` is a permanent URL and nothing here applies.
 * When it is private, `src` is `tools-asset:<key>` and the client mints a
 * short-lived signed URL at render time. Storing the key rather than a signed
 * URL matters: a signed URL baked into the document would expire and the image
 * would silently break.
 *
 * Shared by client and server — no server-only imports.
 */

const ASSET_SCHEME = "tools-asset:"

/** Keys are namespaced by user so one user can never resolve another's object. */
const assetKeyPrefix = (userId: string): string => `assets/${userId}/`

const buildAssetKey = (userId: string, id: string, extension: string): string =>
  `${assetKeyPrefix(userId)}${id}${extension ? `.${extension}` : ""}`

const isAssetReference = (src: string): boolean => src.startsWith(ASSET_SCHEME)

const assetKeyFromSrc = (src: string): string => src.slice(ASSET_SCHEME.length)

const assetSrcFromKey = (key: string): string => `${ASSET_SCHEME}${key}`

/** Conservative allowlist — tldraw only embeds images and video. */
const ALLOWED_CONTENT_TYPE = /^(image|video)\//

/** Object storage has no practical limit; this only stops obvious abuse. */
const MAX_ASSET_BYTES = 50 * 1024 * 1024

const extensionFor = (fileName: string): string => {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName)

  return match ? match[1].toLowerCase() : ""
}

export {
  ALLOWED_CONTENT_TYPE,
  ASSET_SCHEME,
  MAX_ASSET_BYTES,
  assetKeyFromSrc,
  assetKeyPrefix,
  assetSrcFromKey,
  buildAssetKey,
  extensionFor,
  isAssetReference,
}
