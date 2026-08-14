"use client"

import { Copy, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react"
import Link from "next/link"
import { type FunctionComponent, useState } from "react"
import { useDismissableMenu } from "@/components/tools/draw/floating-menu"
import ShareControls from "@/components/tools/draw/share-controls"
import { startNavigation, withProgress } from "@/lib/ui/progress"
import { cn } from "@/lib/utils"

type GalleryDrawing = {
  id: string
  title: string
  /** ISO, used for sorting. Display uses the preformatted labels below. */
  updatedAt: string
  updatedLabel: string
  updatedAbsolute: string
  /** Doubles as "has a preview" and as the cache buster on the preview URL. */
  thumbnailVersion: string | null
  isShared: boolean
}

type Props = Readonly<{
  drawing: GalleryDrawing
  onChanged: () => void
}>

const menuItemClasses = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"

const DrawingCard: FunctionComponent<Props> = ({ drawing, onChanged }) => {
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [isShared, setIsShared] = useState(drawing.isShared)
  const [draftTitle, setDraftTitle] = useState(drawing.title)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)

    try {
      await withProgress(action)
    } finally {
      setBusy(false)
    }
  }

  const submitRename = async () => {
    const next = draftTitle.trim()

    setRenaming(false)

    if (next.length === 0 || next === drawing.title) {
      return
    }

    await run(async () => {
      await fetch(`/api/drawings/${drawing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: next }),
      })

      onChanged()
    })
  }

  const duplicate = async () => {
    setOpen(false)

    await run(async () => {
      await fetch(`/api/drawings/${drawing.id}/duplicate`, { method: "POST" })

      onChanged()
    })
  }

  const remove = async () => {
    setOpen(false)
    setConfirmingDelete(false)

    await run(async () => {
      await fetch(`/api/drawings/${drawing.id}`, { method: "DELETE" })

      onChanged()
    })
  }

  const preview = drawing.thumbnailVersion === null
    ? (
      <div className="flex size-full items-center justify-center bg-muted">
        <span className="text-3xl font-semibold text-muted-foreground/50">
          {(drawing.title.trim()[0] ?? "?").toUpperCase()}
        </span>
      </div>
    )
    : (
      // A plain <img>: the route is private and authenticated by cookie, so the
      // Next image optimizer — which refetches server-side without them — would
      // only ever get a 401.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/drawings/${drawing.id}/thumbnail?v=${encodeURIComponent(drawing.thumbnailVersion)}`}
        alt=""
        loading="lazy"
        className="size-full bg-white object-contain"
      />
    )

  return (
    <div className={cn("group relative", busy && "opacity-60")}>
      {renaming
        ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="aspect-4/3 overflow-hidden">{preview}</div>

            <form
              className="px-3 py-2.5"
              onSubmit={event => {
                event.preventDefault()
                void submitRename()
              }}
            >
              <input
                autoFocus
                value={draftTitle}
                onChange={event => setDraftTitle(event.target.value)}
                onBlur={() => void submitRename()}
                aria-label="Drawing name"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </form>
          </div>
        )
        : (
          <Link
            href={`/draw/${drawing.id}`}
            onClick={() => startNavigation()}
            className="block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="aspect-4/3 overflow-hidden">{preview}</div>

            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-medium">{drawing.title}</p>

              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span title={drawing.updatedAbsolute}>{drawing.updatedLabel}</span>

                {/* Visible at a glance, so a live link is never forgotten. */}
                {isShared && (
                  <span
                    title="Anyone with the link can view this drawing"
                    className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
                  >
                    <Share2 className="size-3" aria-hidden="true"/>
                    Shared
                  </span>
                )}
              </p>
            </div>
          </Link>
        )}

      <div ref={ref} className="absolute right-2 top-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setConfirmingDelete(false)
            setSharing(false)
            setOpen(current => !current)
          }}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Actions for ${drawing.title}`}
          className={cn(
            "flex size-8 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            // Revealed on hover on pointer devices, always visible on touch,
            // where there is no hover to reveal it.
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100",
          )}
        >
          <MoreHorizontal className="size-4" aria-hidden="true"/>
        </button>

        {open && (
          <div
            role="menu"
            className={cn(
              "absolute right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg",
              // The share view holds a full URL; the action list does not.
              sharing ? "w-72 p-1" : "w-48",
            )}
          >
            {sharing && (
              <ShareControls drawingId={drawing.id} onSharedChange={setIsShared}/>
            )}

            {/* Three independent guards rather than nested ternaries: the menu
                has three mutually exclusive faces and reads better flat. */}
            {!sharing && confirmingDelete && (
              <>
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    Delete this drawing? This cannot be undone.
                  </p>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => void remove()}
                    className={cn(menuItemClasses, "text-destructive hover:bg-destructive/10")}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true"/>
                    Yes, delete
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setConfirmingDelete(false)}
                    className={menuItemClasses}
                  >
                    Cancel
                  </button>
              </>
            )}

            {!sharing && !confirmingDelete && (
              <>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => {
                      setDraftTitle(drawing.title)
                      setRenaming(true)
                      setOpen(false)
                    }}
                    className={menuItemClasses}
                  >
                    <Pencil className="size-3.5" aria-hidden="true"/>
                    Rename
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setSharing(true)}
                    className={menuItemClasses}
                  >
                    <Share2 className="size-3.5" aria-hidden="true"/>
                    {isShared ? "Share link" : "Share"}
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => void duplicate()}
                    className={menuItemClasses}
                  >
                    <Copy className="size-3.5" aria-hidden="true"/>
                    Duplicate
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => setConfirmingDelete(true)}
                    className={cn(menuItemClasses, "text-destructive hover:bg-destructive/10")}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true"/>
                    Delete
                  </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DrawingCard
export type { GalleryDrawing }
