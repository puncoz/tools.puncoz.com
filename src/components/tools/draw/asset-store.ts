"use client"

import type { TLAsset, TLAssetStore } from "tldraw"
import { assetKeyFromSrc, isAssetReference } from "@/lib/storage/asset-key"

/** Signed URLs last an hour; refreshed early so one never expires mid-render. */
const RESOLVE_CACHE_MS = 55 * 60 * 1000

const resolveCache = new Map<string, { url: string, expiresAt: number }>()

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"))
    reader.readAsDataURL(file)
  })

/**
 * Stores image and video assets in the user's own object storage.
 *
 * Upload is a two-step presigned PUT: the app mints a signed URL, then the
 * browser sends the file straight to the bucket. The file never passes through
 * the server, which is what keeps uploads clear of Vercel's 4.5 MB body cap.
 *
 * With no storage configured this falls back to tldraw's default behaviour of
 * embedding the file as a data URL, so images keep working — the document size
 * guard is what then warns before saving breaks.
 */
const createAssetStore = (): TLAssetStore => ({
  async upload(_asset: TLAsset, file: File) {
    const response = await fetch("/api/assets/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: file.type,
        fileName: file.name,
        size: file.size,
      }),
    })

    if (response.status === 409) {
      // No object storage configured — embed inline, as tldraw does by default.
      return { src: await fileToDataUrl(file) }
    }

    if (!response.ok) {
      throw new Error(`Could not prepare upload (${response.status})`)
    }

    const { uploadUrl, src } = await response.json() as { uploadUrl: string, src: string }

    const put = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      // Must match the signature's ContentType or the bucket rejects it.
      headers: { "content-type": file.type },
    })

    if (!put.ok) {
      throw new Error(`Upload to storage failed (${put.status})`)
    }

    return { src }
  },

  async resolve(asset: TLAsset) {
    const src = "src" in asset.props ? asset.props.src : null

    if (!src) {
      return null
    }

    // Public URLs and legacy inline data URLs are already renderable.
    if (!isAssetReference(src)) {
      return src
    }

    const cached = resolveCache.get(src)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.url
    }

    const key = assetKeyFromSrc(src)
    const response = await fetch(`/api/assets/resolve?key=${encodeURIComponent(key)}`)

    if (!response.ok) {
      return null
    }

    const { url } = await response.json() as { url: string }

    resolveCache.set(src, { url, expiresAt: Date.now() + RESOLVE_CACHE_MS })

    return url
  },
})

export { createAssetStore }
