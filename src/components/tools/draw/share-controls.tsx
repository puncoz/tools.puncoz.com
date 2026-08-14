"use client"

import { Check, Copy, Loader2, RefreshCw, Link2Off } from "lucide-react"
import { type FunctionComponent, useEffect, useState } from "react"
import { shareLinkPath } from "@/lib/drawings/share"
import { withProgress } from "@/lib/ui/progress"
import { cn } from "@/lib/utils"

type Props = Readonly<{
  drawingId: string
  /** Told to the parent so a gallery badge or panel label can follow along. */
  onSharedChange?: (isShared: boolean) => void
}>

const actionClasses = "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"

/**
 * Enable, copy, rotate and revoke a drawing's share link.
 *
 * One component for both placements — the canvas panel and the gallery card menu
 * — so the wording and the behaviour cannot drift apart.
 *
 * The token is fetched on mount rather than passed in: it is a live credential,
 * and keeping it out of the drawing list means it never lands in the gallery's
 * HTML, where a screenshot or a screen-share would leak every link at once.
 */
const ShareControls: FunctionComponent<Props> = ({ drawingId, onSharedChange }) => {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch(`/api/drawings/${drawingId}/share`)
        const data = response.ok
          ? await response.json() as { shareToken: string | null }
          : { shareToken: null }

        if (!cancelled) {
          setToken(data.shareToken)
          setLoading(false)
          // Reconciles the caller's server-rendered guess with the live value —
          // the link may have been revoked from another device since.
          onSharedChange?.(data.shareToken !== null)
        }
      } catch {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
    // `onSharedChange` is deliberately not a dependency: callers pass an inline
    // closure, and depending on it would refetch the token on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingId])

  const mutate = async (init: RequestInit) => {
    setBusy(true)
    setError(null)

    try {
      await withProgress(async () => {
        const response = await fetch(`/api/drawings/${drawingId}/share`, init)

        if (!response.ok) {
          throw new Error("That did not work. Try again.")
        }

        const { shareToken } = await response.json() as { shareToken: string | null }

        setToken(shareToken)
        setCopied(false)
        onSharedChange?.(shareToken !== null)
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.")
    } finally {
      setBusy(false)
    }
  }

  const enable = () => mutate({ method: "POST" })

  const rotate = () => mutate({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rotate: true }),
  })

  const revoke = () => mutate({ method: "DELETE" })

  // Built here rather than on the server: the origin is whatever the owner is
  // actually browsing, which is correct in development and production alike.
  const link = token === null ? "" : `${window.location.origin}${shareLinkPath(token)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError("Could not copy — select the link and copy it manually.")
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true"/>
        Loading
      </p>
    )
  }

  if (token === null) {
    return (
      <div className="px-1 py-1">
        <p className="text-xs text-muted-foreground">
          Create a link so anyone can view this drawing without signing in.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Create share link
        </button>

        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="px-1 py-1">
      <p className="text-xs text-muted-foreground">
        Anyone with this link can view this drawing.
      </p>

      <div className="mt-2 flex items-center gap-1">
        <input
          readOnly
          value={link}
          aria-label="Share link"
          onFocus={event => event.target.select()}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <button
          type="button"
          onClick={() => void copy()}
          aria-label="Copy share link"
          className={cn(actionClasses, "shrink-0")}
        >
          {copied
            ? <Check className="size-3.5 text-foreground" aria-hidden="true"/>
            : <Copy className="size-3.5" aria-hidden="true"/>}
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          disabled={busy}
          onClick={() => void rotate()}
          title="Replace the link. The old one stops working."
          className={actionClasses}
        >
          <RefreshCw className="size-3.5" aria-hidden="true"/>
          New link
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void revoke()}
          className={cn(actionClasses, "text-destructive hover:bg-destructive/10 hover:text-destructive")}
        >
          <Link2Off className="size-3.5" aria-hidden="true"/>
          Stop sharing
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default ShareControls
