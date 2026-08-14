import { assetKeyFromSrc, isAssetReference } from "@/lib/storage/asset-key"

/**
 * The storage keys a tldraw document actually references.
 *
 * Used to confine a share token to the drawing it was issued for: a token can
 * only unlock assets this document names, not every object in the owner's bucket.
 *
 * The document is stored as untyped jsonb and may predate any given schema
 * version, so this walks it defensively rather than trusting a shape.
 */
const assetKeysInDocument = (document: unknown): Set<string> => {
  const keys = new Set<string>()

  if (typeof document !== "object" || document === null || !("store" in document)) {
    return keys
  }

  const store = (document as { store: unknown }).store

  if (typeof store !== "object" || store === null) {
    return keys
  }

  for (const record of Object.values(store as Record<string, unknown>)) {
    if (typeof record !== "object" || record === null) {
      continue
    }

    const { typeName, props } = record as { typeName?: unknown, props?: unknown }

    if (typeName !== "asset" || typeof props !== "object" || props === null) {
      continue
    }

    const { src } = props as { src?: unknown }

    if (typeof src === "string" && isAssetReference(src)) {
      keys.add(assetKeyFromSrc(src))
    }
  }

  return keys
}

export { assetKeysInDocument }
