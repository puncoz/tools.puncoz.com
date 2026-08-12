"use client"

import { CloudUpload, Loader2, X } from "lucide-react"
import Link from "next/link"
import { type FunctionComponent, useEffect, useState } from "react"
import { findLegacyDrawings, type LegacyDrawing } from "@/lib/tldraw/legacy-store"
import { withProgress } from "@/lib/ui/progress"

/** Set once the prompt has been dealt with, so it does not reappear every visit. */
const DISMISSED_KEY = "tools.puncoz.com:legacy-import-dismissed"

/** Deterministic, so re-importing the same local store is detectable server-side. */
const importTitle = (persistenceKey: string): string => `Imported — ${persistenceKey}`

type Phase = "checking" | "found" | "importing" | "done" | "hidden"

/**
 * Offers to copy drawings out of this browser's IndexedDB into the account.
 *
 * Deliberately explicit rather than automatic: an automatic import cannot be
 * reviewed, and would duplicate drawings if it ran on a second device.
 *
 * IMPORTANT: this only sees data in the browser it runs in. Drawings made on the
 * deployed site have to be imported from that browser, not from localhost.
 */
const ImportLegacyDrawings: FunctionComponent = () => {
  const [phase, setPhase] = useState<Phase>("checking")
  const [legacy, setLegacy] = useState<LegacyDrawing[]>([])
  const [imported, setImported] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Wrapped in an async function so no setState runs synchronously in the
    // effect body, which would trigger a cascading render.
    const detect = async () => {
      if (window.localStorage.getItem(DISMISSED_KEY)) {
        if (!cancelled) {
          setPhase("hidden")
        }

        return
      }

      try {
        const found = await findLegacyDrawings()

        if (!cancelled) {
          setLegacy(found)
          setPhase(found.length > 0 ? "found" : "hidden")
        }
      } catch {
        if (!cancelled) {
          setPhase("hidden")
        }
      }
    }

    void detect()

    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, new Date().toISOString())
    setPhase("hidden")
  }

  const runImport = () => withProgress(async () => {
    setPhase("importing")
    setError(null)

    // The localStorage flag alone is not enough to prevent duplicates: it is
    // per-browser and can be cleared, and the same local store may be imported
    // from another device. Checking what is already on the server makes a
    // repeat import a no-op instead.
    let alreadyImported = new Set<string>()

    try {
      const response = await fetch("/api/drawings")

      if (response.ok) {
        const { drawings } = await response.json() as { drawings: { title: string }[] }

        alreadyImported = new Set(drawings.map(drawing => drawing.title))
      }
    } catch {
      // Non-fatal: worst case a duplicate is created, which is recoverable.
    }

    let count = 0

    for (const drawing of legacy) {
      const title = importTitle(drawing.persistenceKey)

      if (alreadyImported.has(title)) {
        count += 1
        setImported(count)

        continue
      }

      try {
        const response = await fetch("/api/drawings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, document: drawing.document }),
        })

        if (!response.ok) {
          throw new Error(`Import failed (${response.status})`)
        }

        count += 1
        setImported(count)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Import failed")
        setPhase("found")

        return
      }
    }

    // Only set once every drawing is safely on the server. The local IndexedDB
    // data is left untouched, so a failed import can simply be retried.
    window.localStorage.setItem(DISMISSED_KEY, new Date().toISOString())
    setPhase("done")
  })

  if (phase === "checking" || phase === "hidden") {
    return null
  }

  if (phase === "done") {
    return (
      <div className="mb-8 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        Imported {imported} {imported === 1 ? "drawing" : "drawings"}.{" "}
        <Link href="/draw" className="font-medium underline underline-offset-4">Open Draw</Link>
      </div>
    )
  }

  const totalShapes = legacy.reduce((sum, drawing) => sum + drawing.shapeCount, 0)

  return (
    <div className="mb-8 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        <CloudUpload className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true"/>

        <div className="flex-1 text-sm">
          <p className="font-medium">
            {legacy.length} {legacy.length === 1 ? "drawing" : "drawings"} found in this browser
          </p>

          <p className="mt-1 text-muted-foreground">
            {totalShapes} {totalShapes === 1 ? "shape" : "shapes"} saved locally, before drawings synced to
            your account. Import to reach them from any device. Nothing is deleted from this browser.
          </p>

          {error && <p className="mt-2 text-destructive">{error}</p>}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={phase === "importing"}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {phase === "importing" && <Loader2 className="size-3.5 animate-spin" aria-hidden="true"/>}
              {phase === "importing" ? `Importing ${imported}/${legacy.length}` : "Import"}
            </button>

            <button
              type="button"
              onClick={dismiss}
              disabled={phase === "importing"}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          disabled={phase === "importing"}
          className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          <X className="size-4" aria-hidden="true"/>
        </button>
      </div>
    </div>
  )
}

export default ImportLegacyDrawings
