"use client"

import { FilePlus2, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FunctionComponent, useEffect, useMemo, useRef, useState } from "react"
import DrawingCard, { type GalleryDrawing } from "@/components/tools/draw/drawing-card"
import { inputClasses } from "@/components/ui/input"
import { startNavigation, withProgress } from "@/lib/ui/progress"
import { cn } from "@/lib/utils"

type Sort = "recent" | "name"

type Props = Readonly<{ drawings: GalleryDrawing[] }>

const SORT_OPTIONS: { value: Sort, label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "name", label: "A–Z" },
]

/** Every term must appear in the title, so extra words narrow rather than widen. */
const matches = (title: string, query: string): boolean => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const haystack = title.toLowerCase()

  return terms.every(term => haystack.includes(term))
}

const DrawingGallery: FunctionComponent<Props> = ({ drawings }) => {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<Sort>("recent")
  const [creating, setCreating] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => {
    const filtered = drawings.filter(drawing => matches(drawing.title, query))

    // Filtering and sorting run here rather than in the query: the list is one
    // person's drawings, and a round trip per keystroke would be worse than
    // sorting a few dozen rows. If this ever holds hundreds, move it to SQL.
    return sort === "name"
      ? [...filtered].sort((a, b) => a.title.localeCompare(b.title))
      : [...filtered].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [drawings, query, sort])

  // "/" focuses search, matching the tool directory on the landing page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target?.isContentEditable

      if (event.key === "/" && !isTyping) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const createDrawing = async () => {
    setCreating(true)

    try {
      await withProgress(async () => {
        const response = await fetch("/api/drawings", { method: "POST" })

        if (response.ok) {
          const { drawing } = await response.json() as { drawing: { id: string } }

          // Handed to the navigation flag so the progress bar stays up until the
          // canvas renders, rather than ending when the fetch resolves.
          startNavigation()
          router.push(`/draw/${drawing.id}`)
        }
      })
    } finally {
      setCreating(false)
    }
  }

  const newDrawingButton = (
    <button
      type="button"
      disabled={creating}
      onClick={() => void createDrawing()}
      className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <FilePlus2 className="size-4" aria-hidden="true"/>
      New drawing
    </button>
  )

  if (drawings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No drawings yet. Create one to get started.
        </p>

        <div className="mt-4 flex justify-center">{newDrawingButton}</div>
      </div>
    )
  }

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="drawing-search" className="sr-only">Search drawings</label>

        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />

          <input
            id="drawing-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search drawings..."
            className={inputClasses("bg-card py-2.5 pl-9 pr-16")}
          />

          {query.length === 0 && (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:block">
              /
            </kbd>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Sort drawings">
            {SORT_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSort(option.value)}
                aria-pressed={sort === option.value}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sort === option.value
                    ? "bg-brand-subtle text-brand"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {newDrawingButton}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {visible.length} {visible.length === 1 ? "drawing" : "drawings"} found
      </p>

      {visible.length > 0
        ? (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map(drawing => (
              <li key={drawing.id}>
                <DrawingCard drawing={drawing} onChanged={() => router.refresh()}/>
              </li>
            ))}
          </ul>
        )
        : (
          <div className="mt-6 rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No drawings match <span className="font-medium text-foreground">{query}</span>.
            </p>

            <button
              type="button"
              onClick={() => {
                setQuery("")
                searchRef.current?.focus()
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              <X className="size-3.5" aria-hidden="true"/>
              Clear search
            </button>
          </div>
        )}
    </section>
  )
}

export default DrawingGallery
