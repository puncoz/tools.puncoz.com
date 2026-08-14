"use client"

import { Search } from "lucide-react"
import { type FunctionComponent, useMemo, useRef, useState } from "react"
import { createShapeId, toRichText, useEditor } from "tldraw"
import { DROPDOWN_CLASSES, PANEL_CLASSES, useDismissableMenu } from "@/components/tools/draw/floating-menu"
import {
  AWS_ICON_TYPE,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  type AwsIconShape,
} from "@/components/tools/draw/shapes/aws-icon-shape-util"
import { AWS_ICONS, awsIconUrl, matchesAwsIcon } from "@/lib/aws-icons"
import { cn } from "@/lib/utils"

/**
 * Inserts AWS service icons onto the canvas.
 *
 * Search-first over a flat A–Z list rather than grouped by AWS category: the
 * icon package carries no category data, its upstream metadata carries none
 * either, and the categories cannot be recovered from the artwork — all 300
 * service icons share just 7 fill colours, reused across AWS's 26 published
 * categories. Grouping would mean inventing a mapping that drifts on every
 * package update. Service names are distinctive enough that search wins anyway.
 */
const AwsIconPicker: FunctionComponent = () => {
  const editor = useEditor()
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  const visible = useMemo(
    () => AWS_ICONS.filter(icon => matchesAwsIcon(icon, query)),
    [query],
  )

  const insert = (slug: string, name: string) => {
    // Centre of what the user is currently looking at, so the shape never lands
    // off-screen on a panned canvas.
    const { x, y } = editor.getViewportPageBounds().center

    editor.createShape<AwsIconShape>({
      id: createShapeId(),
      type: AWS_ICON_TYPE,
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
        title="AWS icons"
        aria-label="AWS icons"
        className={cn(PANEL_CLASSES, "flex size-9 items-center justify-center text-[11px] font-semibold tracking-tight transition-colors hover:bg-accent")}
      >
        AWS
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
              ref={searchRef}
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search 300 AWS services..."
              aria-label="Search AWS services"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <p aria-live="polite" className="sr-only">
            {visible.length} {visible.length === 1 ? "service" : "services"} found
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
                      src={awsIconUrl(icon.slug)}
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
                No services match <span className="font-medium text-foreground">{query}</span>.
              </p>
            )}
        </div>
      )}
    </div>
  )
}

export default AwsIconPicker
