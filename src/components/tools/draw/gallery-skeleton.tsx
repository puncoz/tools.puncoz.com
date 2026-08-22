import type { FunctionComponent } from "react"
import { FIRST_ROW } from "@/components/tools/draw/drawing-preview"

/**
 * What `/draw` shows while its two queries are in flight.
 *
 * This exists so the document can be flushed before the database has answered.
 * `/draw` had the worst TTFB on the site at 2.79s, and none of it was query
 * cost — the indexes cover both queries and ADR 0005 already moved the
 * functions next to the database. It was serialisation: identity lookup, then
 * the drawing list, then render, then the first byte. See ADR 0010.
 *
 * Covers the card grid only. The count line above it streams separately and
 * carries its own placeholder, because it sits inside the heading block rather
 * than in this column.
 *
 * The card count matches one row, and the card dimensions match the real ones in
 * `drawing-card.tsx` and `trash-gallery.tsx`, because a fallback that resizes
 * when it is replaced would trade the TTFB win for a layout shift and score no
 * better. Both galleries also render a search-and-sort bar above the grid, which
 * is why the grid here starts below one.
 */

const GallerySkeleton: FunctionComponent = () => (
  <div className="animate-pulse">
    {/* The search and sort controls the two galleries put above their grids. */}
    <div className="h-9 w-full max-w-xs rounded-lg bg-muted"/>

    <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: FIRST_ROW }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="aspect-4/3 bg-muted"/>

          <div className="px-3 py-2.5">
            <div className="h-3.5 w-2/3 rounded bg-muted"/>
            <div className="mt-2 h-3 w-1/3 rounded bg-muted"/>
          </div>
        </li>
      ))}
    </ul>
  </div>
)

export default GallerySkeleton
