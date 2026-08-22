"use client"

import { Search } from "lucide-react"
import Link from "next/link"
import { type FunctionComponent, useMemo, useState } from "react"
import { createShapeId, toRichText, useEditor } from "tldraw"
import { DROPDOWN_CLASSES, PANEL_CLASSES, useDismissableMenu } from "@/components/tools/draw/floating-menu"
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  type AnyIconShape,
} from "@/components/tools/draw/shapes/icon-shape-util"
import { sentence } from "@/lib/credits"
import { matchesIcon, type IconSet } from "@/lib/icon-sets"
import { cn } from "@/lib/utils"

/**
 * Inserts provider icons onto the canvas — one instance per icon set.
 *
 * Search-first over a flat A–Z list rather than grouped by the provider's own
 * categories: the AWS package carries no category data and the categories cannot
 * be recovered from the artwork, all 300 service icons sharing just 7 fill
 * colours across AWS's 26 published categories. Grouping would mean inventing a
 * mapping that drifts on every package update, and service names are distinctive
 * enough that search wins anyway. Cloudflare's set is small enough not to need it.
 */

type Props = Readonly<{
  set: IconSet
  /** The shape type this set inserts. Paired here rather than in `lib/icon-sets`,
      which must not import from `components/`. */
  shapeType: AnyIconShape["type"]
}>

const IconPicker: FunctionComponent<Props> = ({ set, shapeType }) => {
  const editor = useEditor()
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()
  const [query, setQuery] = useState("")

  const visible = useMemo(
    () => set.icons.filter(icon => matchesIcon(icon, query)),
    [set, query],
  )

  const insert = (slug: string, name: string) => {
    // Centre of what the user is currently looking at, so the shape never lands
    // off-screen on a panned canvas.
    const { x, y } = editor.getViewportPageBounds().center

    editor.createShape<AnyIconShape>({
      id: createShapeId(),
      type: shapeType,
      x: x - DEFAULT_WIDTH / 2,
      y: y - DEFAULT_HEIGHT / 2,
      props: {
        w: DEFAULT_WIDTH,
        h: DEFAULT_HEIGHT,
        service: slug,
        richText: toRichText(name),
      },
    })

    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={set.title}
        aria-label={set.title}
        className={cn(PANEL_CLASSES, "flex size-9 items-center justify-center text-[11px] font-semibold tracking-tight transition-colors hover:bg-accent")}
      >
        {set.label}
      </button>

      {open && (
        <div className={cn(DROPDOWN_CLASSES, "left-0 w-80 p-2")}>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />

            <input
              autoFocus
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={`Search ${set.icons.length} ${set.label} icons...`}
              aria-label={`Search ${set.title}`}
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <p aria-live="polite" className="sr-only">
            {visible.length} {visible.length === 1 ? "icon" : "icons"} found
          </p>

          {visible.length > 0
            ? (
              <div className="mt-2 grid max-h-80 grid-cols-4 gap-1 overflow-y-auto">
                {visible.map(icon => (
                  <button
                    key={icon.slug}
                    type="button"
                    onClick={() => insert(icon.slug, icon.name)}
                    title={icon.name}
                    className="flex flex-col items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- static
                        same-origin SVG; the Next optimizer cannot process SVG. */}
                    <img
                      src={set.urlFor(icon.slug)}
                      alt=""
                      loading="lazy"
                      className="size-8"
                    />

                    <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted-foreground">
                      {icon.name}
                    </span>
                  </button>
                ))}
              </div>
            )
            : (
              <p className="mt-3 px-1 pb-2 text-center text-xs text-muted-foreground">
                No icons match <span className="font-medium text-foreground">{query}</span>.
              </p>
            )}

          {/* The canvas is full-bleed and has no footer, and neither does the
              share view — so this is the only place the person placing the
              artwork is told whose it is. Anchored to the matching section
              rather than the top of the page. */}
          <p className="mt-2 border-t border-border px-1 pt-2 text-[10px] leading-tight text-muted-foreground">
            Artwork by {sentence(set.credit.holder)}{" "}
            <Link
              href={`/credits#${set.credit.id}`}
              target="_blank"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Credits
            </Link>
          </p>
        </div>
      )}
    </div>
  )
}

export default IconPicker
