"use client"

import { LayoutGrid } from "lucide-react"
import Link from "next/link"
import type { FunctionComponent } from "react"
import { DefaultMenuPanel } from "tldraw"
import IconPicker from "@/components/tools/draw/icon-picker"
import { AWS_ICON_TYPE } from "@/components/tools/draw/shapes/aws-icon-shape-util"
import { CLOUDFLARE_ICON_TYPE } from "@/components/tools/draw/shapes/cloudflare-icon-shape-util"
import { AWS_ICON_SET, CLOUDFLARE_ICON_SET } from "@/lib/icon-sets"

/**
 * Rendered into tldraw's `MenuPanel` zone (top-left).
 *
 * `DefaultMenuPanel` is rendered alongside rather than replaced, so tldraw's
 * own main menu, page menu and undo/redo keep working — this only adds a way
 * out of the canvas.
 *
 * Points at the gallery rather than the site root: it is one step up rather than
 * all the way out, and the gallery carries its own link back to the tools list.
 */
const HomeButton: FunctionComponent = () => (
  <div className="flex items-center gap-1">
    <Link
      href="/draw"
      title="All drawings"
      aria-label="All drawings"
      className="pointer-events-auto flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
    >
      <LayoutGrid className="size-4" aria-hidden="true"/>
    </Link>

    <DefaultMenuPanel/>

    <IconPicker set={AWS_ICON_SET} shapeType={AWS_ICON_TYPE}/>

    <IconPicker set={CLOUDFLARE_ICON_SET} shapeType={CLOUDFLARE_ICON_TYPE}/>
  </div>
)

export default HomeButton
