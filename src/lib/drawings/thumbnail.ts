/**
 * Gallery previews.
 *
 * A thumbnail is a data URL rendered in the browser by the tldraw editor that is
 * already open, stored as a text column, and served back as raw image bytes.
 *
 * Shared by client and server, so it must not import anything server-only. The
 * client uses the limits to decide when to retry smaller; the server re-checks
 * the same values before anything reaches the database.
 */

/**
 * Cap on the stored data URL. A 640×480 sketch encodes to roughly 20–80 KB, so
 * this leaves generous headroom while keeping a pathological drawing — a photo
 * pasted at full bleed — from bloating the row.
 */
const MAX_THUMBNAIL_BYTES = 400_000

/** Target for the longest edge of the rendered preview. */
const THUMBNAIL_MAX_WIDTH = 640
const THUMBNAIL_MAX_HEIGHT = 480

/**
 * `webp` is what the editor is asked for. `png` is accepted too: `toImage` falls
 * back to it on browsers whose `canvas.toBlob` cannot encode webp.
 */
const THUMBNAIL_MIME_TYPES = ["image/webp", "image/png"] as const

type ThumbnailMime = typeof THUMBNAIL_MIME_TYPES[number]

type ParsedThumbnail = { mime: ThumbnailMime, base64: string }

const DATA_URL_PATTERN = /^data:(image\/webp|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/

/**
 * Validates a candidate thumbnail and splits it into mime and payload.
 *
 * Returns null for anything that is not a well-formed data URL of an allowed
 * type and within the size cap. Callers must treat null as "reject", never as
 * "store as-is": the parsed mime is what the serving route echoes back as
 * `Content-Type`, so an unvalidated value would let a caller choose the type a
 * browser renders these bytes as.
 */
const parseThumbnail = (value: unknown): ParsedThumbnail | null => {
  if (typeof value !== "string" || value.length > MAX_THUMBNAIL_BYTES) {
    return null
  }

  const match = DATA_URL_PATTERN.exec(value)

  if (!match) {
    return null
  }

  const [, mime, base64] = match

  return { mime: mime as ThumbnailMime, base64 }
}

export {
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_MAX_HEIGHT,
  THUMBNAIL_MAX_WIDTH,
  THUMBNAIL_MIME_TYPES,
  parseThumbnail,
}
export type { ParsedThumbnail, ThumbnailMime }
