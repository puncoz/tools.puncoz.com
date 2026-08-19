"use client"

import { Search, X } from "lucide-react"
import { type FunctionComponent, useEffect, useMemo, useRef, useState } from "react"
import ToolCard from "@/components/tools/tool-card"
import { inputClasses } from "@/components/ui/input"
import { CATEGORY_LABELS, TOOLS, matchesQuery, usedCategories, type ToolCategory } from "@/lib/tools"
import { cn } from "@/lib/utils"

type Filter = ToolCategory | "all"

const chipClasses = "rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

const ToolDirectory: FunctionComponent = () => {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const searchRef = useRef<HTMLInputElement>(null)

  const categories = useMemo(() => usedCategories(TOOLS), [])

  const visible = useMemo(
    () => TOOLS.filter(tool =>
      (filter === "all" || tool.category === filter) && matchesQuery(tool, query),
    ),
    [query, filter],
  )

  // "/" focuses search, the convention on tool directories. Ignored while the
  // user is already typing somewhere, so it never swallows a literal slash.
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

  const clear = () => {
    setQuery("")
    setFilter("all")
    searchRef.current?.focus()
  }

  return (
    <section className="w-full">
      <label htmlFor="tool-search" className="sr-only">Search tools</label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />

        <input
          id="tool-search"
          ref={searchRef}
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search tools..."
          className={inputClasses("bg-card py-2.5 pl-9 pr-16")}
        />

        {query.length === 0 && (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground sm:block">
            /
          </kbd>
        )}
      </div>

      {categories.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            className={cn(
              chipClasses,
              filter === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>

          {categories.map(category => (
            <button
              key={category}
              type="button"
              onClick={() => setFilter(category)}
              aria-pressed={filter === category}
              className={cn(
                chipClasses,
                filter === category
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {visible.length} {visible.length === 1 ? "tool" : "tools"} found
      </p>

      {visible.length > 0
        ? (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(tool => (
              <li key={tool.slug}>
                <ToolCard tool={tool}/>
              </li>
            ))}
          </ul>
        )
        : (
          <div className="mt-6 rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No tools match <span className="font-medium text-foreground">{query}</span>.
            </p>

            <button
              type="button"
              onClick={clear}
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

export default ToolDirectory
