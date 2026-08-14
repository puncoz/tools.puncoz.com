"use client"

import type { TLAsset, TLAssetStore } from "tldraw"
import { assetKeyFromSrc, isAssetReference } from "@/lib/storage/asset-key"

/** Signed URLs last an hour; refreshed early so one never expires mid-render. */
const RESOLVE_CACHE_MS = 55 * 60 * 1000

/**
 * Read-only asset store for a shared drawing.
 *
 * Same resolve behaviour as the owner's store, but pointed at the share-scoped
 * route, since a visitor has no session for `/api/assets/resolve` to authenticate.
 *
 * `upload` throws rather than being omitted: the interface requires it, and a
 * shared canvas that silently accepted an upload it could never save would be
 * worse than one that refuses. Nothing in the read-only UI can reach it anyway.
 */
const createSharedAssetStore = (token: string): TLAssetStore => {
  const resolveCache = new Map<string, { url: string, expiresAt: number }>()

  return {
    upload() {
      return Promise.reject(new Error("This drawing is read-only."))
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
      const response = await fetch(
        `/api/share/${encodeURIComponent(token)}/assets/resolve?key=${encodeURIComponent(key)}`,
      )

      if (!response.ok) {
        return null
      }

      const { url } = await response.json() as { url: string }

      resolveCache.set(src, { url, expiresAt: Date.now() + RESOLVE_CACHE_MS })

      return url
    },
  }
}

export { createSharedAssetStore }
