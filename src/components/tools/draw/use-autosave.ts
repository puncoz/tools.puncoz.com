"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getSnapshot, type TLStore } from "tldraw"
import { MAX_DOCUMENT_BYTES, documentByteSize } from "@/lib/drawings/limits"

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved", at: Date }
  | { status: "error", message: string }

const DEBOUNCE_MS = 1_500

/** Fetch caps `keepalive` request bodies at 64 KB, so unload-flush only helps small documents. */
const KEEPALIVE_MAX_BYTES = 64_000

/**
 * Persists a tldraw store to the server, debounced.
 *
 * Only `snapshot.document` is sent. The `session` half (camera, selection) is
 * per-device and deliberately not synced — persisting it would make the
 * viewport jump when the drawing is opened elsewhere.
 */
const useAutosave = (store: TLStore, drawingId: string) => {
  const [state, setState] = useState<SaveState>({ status: "idle" })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  const inFlightRef = useRef(false)

  const save = useCallback(async () => {
    if (inFlightRef.current) {
      return
    }

    const doc = getSnapshot(store).document
    const size = documentByteSize(doc)

    // Caught before the request so the message names the real cause; the server
    // enforces the same limit independently.
    if (size > MAX_DOCUMENT_BYTES) {
      setState({
        status: "error",
        message: "Too large to save — configure object storage to move images out of the drawing.",
      })

      return
    }

    inFlightRef.current = true
    dirtyRef.current = false
    setState({ status: "saving" })

    try {
      const response = await fetch(`/api/drawings/${drawingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document: doc }),
      })

      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`)
      }

      setState({ status: "saved", at: new Date() })
    } catch (error) {
      // Left dirty so the next edit — or the next flush — retries it.
      dirtyRef.current = true
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Save failed",
      })
    } finally {
      inFlightRef.current = false
    }
  }, [store, drawingId])

  useEffect(() => {
    const unlisten = store.listen(
      () => {
        dirtyRef.current = true

        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }

        timerRef.current = setTimeout(save, DEBOUNCE_MS)
      },
      // Only user edits to document records. Without this filter, camera pans
      // and selection changes would each trigger a save.
      { source: "user", scope: "document" },
    )

    return () => {
      unlisten()

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [store, save])

  useEffect(() => {
    // Tab switch / minimise: the page stays alive, so a normal save works and is
    // the main protection against losing an edit inside the debounce window.
    const onHidden = () => {
      if (globalThis.document.visibilityState === "hidden" && dirtyRef.current) {
        void save()
      }
    }

    // Actual teardown: only a keepalive request can outlive the page, and it is
    // capped at 64 KB — best effort for small documents, nothing more.
    const onPageHide = () => {
      if (!dirtyRef.current) {
        return
      }

      const body = JSON.stringify({ document: getSnapshot(store).document })

      if (new TextEncoder().encode(body).length > KEEPALIVE_MAX_BYTES) {
        return
      }

      void fetch(`/api/drawings/${drawingId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined)
    }

    globalThis.document.addEventListener("visibilitychange", onHidden)
    window.addEventListener("pagehide", onPageHide)

    return () => {
      globalThis.document.removeEventListener("visibilitychange", onHidden)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [store, drawingId, save])

  return state
}

export { useAutosave }
export type { SaveState }
