"use client"

import { RotateCcw, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FunctionComponent, useState } from "react"
import DrawingPreview, { FIRST_ROW } from "@/components/tools/draw/drawing-preview"
import { buttonClasses } from "@/components/ui/button"
import { withProgress } from "@/lib/ui/progress"
import { cn } from "@/lib/utils"

type TrashedDrawing = {
  id: string
  title: string
  deletedLabel: string
  deletedAbsolute: string
  /** Doubles as "has a preview" and as the cache buster on the preview URL. */
  thumbnailVersion: string | null
}

type Props = Readonly<{ drawings: TrashedDrawing[] }>

const actionClasses = buttonClasses({ size: "sm" })

const dangerClasses = buttonClasses({ variant: "destructive", size: "sm" })

/**
 * The trash.
 *
 * Deliberately not the gallery with different buttons: nothing here opens, so
 * the cards are not links, and the only two things that can be done to a
 * drawing are the two that are on it. Permanent deletion is the one action in
 * the tool with no way back, so it asks twice — once per card and once for the
 * whole trash — rather than sitting one click away.
 */
const TrashGallery: FunctionComponent<Props> = ({ drawings }) => {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmingEmpty, setConfirmingEmpty] = useState(false)
  const [emptying, setEmptying] = useState(false)

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id)

    try {
      await withProgress(action)
    } finally {
      setBusyId(null)
    }
  }

  const restore = async (id: string) => {
    await run(id, async () => {
      await fetch(`/api/drawings/${id}/trash`, { method: "POST" })

      router.refresh()
    })
  }

  const purge = async (id: string) => {
    setConfirmingId(null)

    await run(id, async () => {
      await fetch(`/api/drawings/${id}/trash`, { method: "DELETE" })

      router.refresh()
    })
  }

  const empty = async () => {
    setConfirmingEmpty(false)
    setEmptying(true)

    try {
      await withProgress(async () => {
        await fetch("/api/drawings/trash", { method: "DELETE" })

        router.refresh()
      })
    } finally {
      setEmptying(false)
    }
  }

  if (drawings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          The trash is empty. Deleted drawings land here and stay until you remove them.
        </p>

        <Link
          href="/draw"
          className="mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Back to drawings
        </Link>
      </div>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Restoring a drawing puts it back in the gallery with its share link intact.
        </p>

        {confirmingEmpty
          ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Delete all {drawings.length} forever?
              </span>

              <button
                type="button"
                disabled={emptying}
                onClick={() => void empty()}
                className={dangerClasses}
              >
                Yes, delete
              </button>

              <button
                type="button"
                onClick={() => setConfirmingEmpty(false)}
                className={actionClasses}
              >
                Cancel
              </button>
            </div>
          )
          : (
            <button
              type="button"
              disabled={emptying}
              onClick={() => setConfirmingEmpty(true)}
              className={dangerClasses}
            >
              <Trash2 className="size-3.5" aria-hidden="true"/>
              Empty trash
            </button>
          )}
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {drawings.map((drawing, index) => (
          <li key={drawing.id}>
            <div className={cn(
              "overflow-hidden rounded-xl border border-border bg-card",
              busyId === drawing.id && "opacity-60",
            )}
            >
              {/* Dimmed and unclickable: this is a record of something deleted,
                  not a drawing you can open. */}
              <div className="aspect-4/3 overflow-hidden opacity-60 grayscale">
                <DrawingPreview
                  drawingId={drawing.id}
                  title={drawing.title}
                  thumbnailVersion={drawing.thumbnailVersion}
                  priority={index < FIRST_ROW}
                />
              </div>

              <div className="px-3 py-2.5">
                <p className="truncate text-sm font-medium">{drawing.title}</p>

                <p className="mt-0.5 text-xs text-muted-foreground" title={drawing.deletedAbsolute}>
                  {drawing.deletedLabel}
                </p>

                {confirmingId === drawing.id
                  ? (
                    <div className="mt-2.5">
                      <p className="text-xs text-muted-foreground">
                        Delete forever? This cannot be undone.
                      </p>

                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === drawing.id}
                          onClick={() => void purge(drawing.id)}
                          className={dangerClasses}
                        >
                          Yes, delete
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className={actionClasses}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )
                  : (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === drawing.id}
                        onClick={() => void restore(drawing.id)}
                        className={actionClasses}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true"/>
                        Restore
                      </button>

                      <button
                        type="button"
                        disabled={busyId === drawing.id}
                        onClick={() => setConfirmingId(drawing.id)}
                        className={dangerClasses}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true"/>
                        Delete forever
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default TrashGallery
export type { TrashedDrawing }
