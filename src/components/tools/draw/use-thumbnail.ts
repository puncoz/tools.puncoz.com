"use client"

import { useEffect, useRef } from "react"
import type { Editor, TLStore } from "tldraw"
import {
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_MAX_HEIGHT,
  THUMBNAIL_MAX_WIDTH,
} from "@/lib/drawings/thumbnail"

/**
 * Rasterising the whole page is far more expensive than serialising it, so this
 * runs on its own much slower cadence than `useAutosave`: a burst of drawing
 * produces many document saves and one preview.
 */
const DEBOUNCE_MS = 10_000

/**
 * Delay before backfilling a drawing that has no preview at all. Long enough for
 * assets to resolve — images arrive from object storage via signed URLs — short
 * enough that opening a drawing once is genuinely all it takes.
 */
const BACKFILL_MS = 2_000

/** Second attempt when the first render lands over the size cap. */
const RETRY_SCALE = 0.6
const RETRY_QUALITY = 0.5
const QUALITY = 0.8

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Could not read the rendered preview."))
    reader.readAsDataURL(blob)
  })

/**
 * Keeps a drawing's gallery previews up to date.
 *
 * Renders the current page to a small webp through the editor that is already
 * open — there is no server-side tldraw — and PATCHes it as a data URL. Two of
 * them: tldraw's exporter takes a `darkMode` flag, so the same page is rendered
 * once per theme and the gallery card can match the page around it.
 *
 * Every failure here is swallowed. A missing or stale preview is a cosmetic
 * problem in a list; it must never surface as an error over someone's drawing,
 * and it must never interfere with saving the document itself.
 */
const useThumbnail = (
  editor: Editor | null,
  store: TLStore,
  drawingId: string,
  needsThumbnail: boolean,
) => {
  // Held in a ref so the capture closure never goes stale, and so a re-render
  // cannot restart the timers mid-debounce.
  const lastSentRef = useRef<string | undefined>(undefined)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!editor) {
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const render = async (
      scale: number,
      quality: number,
      darkMode: boolean,
    ): Promise<string | null> => {
      const shapeIds = [...editor.getCurrentPageShapeIds()]

      if (shapeIds.length === 0) {
        return null
      }

      const result = await editor.toImage(shapeIds, {
        format: "webp",
        quality,
        background: true,
        scale,
        // Bitmap exports default to 2, which would quadruple the pixel count for
        // no benefit at this size.
        pixelRatio: 1,
        darkMode,
      })

      return blobToDataUrl(result.blob)
    }

    const capture = async () => {
      if (inFlightRef.current || cancelled) {
        return
      }

      inFlightRef.current = true

      try {
        const bounds = editor.getCurrentPageBounds()
        const baseScale = bounds
          ? Math.min(
            THUMBNAIL_MAX_WIDTH / Math.max(bounds.width, 1),
            THUMBNAIL_MAX_HEIGHT / Math.max(bounds.height, 1),
            1,
          )
          : 1

        // The light variant drives every decision here: whether the page is
        // empty, and what scale and quality both renders end up using. It is the
        // one every card falls back to, so it is the one worth retrying.
        let scale = baseScale
        let quality = QUALITY
        let light = await render(scale, quality, false)

        // Dense drawings — or a photo pasted at full bleed — can clear the cap
        // even at this size. One smaller attempt, then give up and keep whatever
        // preview is already stored.
        if (light !== null && light.length > MAX_THUMBNAIL_BYTES) {
          scale = baseScale * RETRY_SCALE
          quality = RETRY_QUALITY
          light = await render(scale, quality, false)

          if (light !== null && light.length > MAX_THUMBNAIL_BYTES) {
            return
          }
        }

        // Rendered at whatever the light variant settled on, and dropped rather
        // than retried if it still lands over the cap: the serving route falls
        // back to the light bytes, which beats abandoning the whole update over
        // the variant nobody has asked for yet.
        let dark: string | null = null

        if (light !== null) {
          dark = await render(scale, quality, true)

          if (dark !== null && dark.length > MAX_THUMBNAIL_BYTES) {
            dark = null
          }
        }

        // One key for the pair. Comparing only the light variant would skip the
        // write that first fills in a missing dark one.
        const signature = `${light ?? ""}|${dark ?? ""}`

        if (cancelled || signature === lastSentRef.current) {
          return
        }

        const response = await fetch(`/api/drawings/${drawingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ thumbnail: light, thumbnailDark: dark }),
        })

        if (response.ok) {
          lastSentRef.current = signature
        }
      } catch {
        // Cosmetic. Swallowed on purpose — see the note above.
      } finally {
        inFlightRef.current = false
      }
    }

    const schedule = (delay: number) => {
      if (timer) {
        clearTimeout(timer)
      }

      timer = setTimeout(() => void capture(), delay)
    }

    // A drawing missing either variant gets both from simply being opened, which
    // is what backfills everything that predates this — imported drawings, and
    // drawings whose preview was rendered before there was a dark one.
    if (needsThumbnail) {
      schedule(BACKFILL_MS)
    }

    const unlisten = store.listen(
      () => schedule(DEBOUNCE_MS),
      { source: "user", scope: "document" },
    )

    // Leaving the tab is the common way a short editing session ends. Without
    // this, a minute of drawing followed by a tab switch would leave the gallery
    // showing the previous preview until the next edit.
    const onHidden = () => {
      if (globalThis.document.visibilityState === "hidden" && timer) {
        clearTimeout(timer)
        timer = null
        void capture()
      }
    }

    globalThis.document.addEventListener("visibilitychange", onHidden)

    return () => {
      cancelled = true
      unlisten()
      globalThis.document.removeEventListener("visibilitychange", onHidden)

      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [editor, store, drawingId, needsThumbnail])
}

export { useThumbnail }
