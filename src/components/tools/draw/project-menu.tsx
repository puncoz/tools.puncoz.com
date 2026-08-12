"use client"

import { Check, ChevronDown, FilePlus2, Loader2, Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FunctionComponent, useEffect, useState } from "react"
import { useDrawing } from "@/components/tools/draw/drawing-context"
import { DROPDOWN_CLASSES, PANEL_CLASSES, useDismissableMenu } from "@/components/tools/draw/floating-menu"
import { startNavigation, withProgress } from "@/lib/ui/progress"
import { cn } from "@/lib/utils"

type Summary = { id: string, title: string }

/**
 * Drawing switcher, rendered into tldraw's `TopPanel` zone so it floats over the
 * canvas without taking layout space.
 *
 * The list is fetched when the menu opens rather than on mount: it is only ever
 * needed once the menu is visible, and refetching each time keeps titles current
 * after a rename on another device.
 */
const ProjectMenu: FunctionComponent = () => {
  const { id, title } = useDrawing()
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()
  const router = useRouter()

  const [drawings, setDrawings] = useState<Summary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    void fetch("/api/drawings")
      .then(response => response.ok ? response.json() : { drawings: [] })
      .then((data: { drawings: Summary[] }) => {
        if (!cancelled) {
          setDrawings(data.drawings)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDrawings([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const createDrawing = async () => {
    setBusy(true)

    try {
      await withProgress(async () => {
        const response = await fetch("/api/drawings", { method: "POST" })

        if (response.ok) {
          const { drawing } = await response.json() as { drawing: Summary }

          setOpen(false)
          // Handed to the navigation flag so the bar stays up until the new
          // route renders, rather than ending when the fetch resolves.
          startNavigation()
          router.push(`/draw/${drawing.id}`)
        }
      })
    } finally {
      setBusy(false)
    }
  }

  const submitRename = async () => {
    const next = draftTitle.trim()

    if (next.length === 0 || next === title) {
      setRenaming(false)

      return
    }

    setBusy(true)

    try {
      await withProgress(async () => {
        await fetch(`/api/drawings/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: next }),
        })

        setRenaming(false)
        setOpen(false)
        router.refresh()
      })
    } finally {
      setBusy(false)
    }
  }

  const removeDrawing = async () => {
    setBusy(true)

    try {
      await withProgress(async () => {
        const response = await fetch(`/api/drawings/${id}`, { method: "DELETE" })

        if (response.ok) {
          setOpen(false)
          startNavigation()
          // /draw redirects to the next most recent drawing, or creates one.
          router.push("/draw")
        }
      })
    } finally {
      setBusy(false)
    }
  }

  const others = (drawings ?? []).filter(drawing => drawing.id !== id)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          // Reset here rather than in an effect on close: an effect that calls
          // setState synchronously triggers a cascading render.
          setRenaming(false)
          setOpen(current => !current)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(PANEL_CLASSES, "flex max-w-[40vw] items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent")}
      >
        <span className="truncate">{title}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true"/>
      </button>

      {open && (
        <div role="menu" className={cn(DROPDOWN_CLASSES, "left-1/2 w-64 -translate-x-1/2")}>
          {renaming
            ? (
              <form
                className="px-2 py-1.5"
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
            )
            : (
              <>
                <span role="menuitem" className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Check className="size-3.5 shrink-0" aria-hidden="true"/>
                  <span className="truncate">{title}</span>
                </span>

                {others.length > 0 && (
                  <div className="max-h-56 overflow-y-auto border-y border-border py-1">
                    {others.map(drawing => (
                      <button
                        key={drawing.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpen(false)
                          startNavigation()
                          router.push(`/draw/${drawing.id}`)
                        }}
                        className="flex w-full items-center px-3 py-2 pl-8 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <span className="truncate">{drawing.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {drawings === null && (
                  <span className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true"/>
                    Loading
                  </span>
                )}

                <div className="my-1 h-px bg-border"/>

                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    setDraftTitle(title)
                    setRenaming(true)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Pencil className="size-3.5" aria-hidden="true"/>
                  Rename
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => void createDrawing()}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <FilePlus2 className="size-3.5" aria-hidden="true"/>
                  New drawing
                </button>

                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => void removeDrawing()}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" aria-hidden="true"/>
                  Delete
                </button>
              </>
            )}
        </div>
      )}
    </div>
  )
}

export default ProjectMenu
