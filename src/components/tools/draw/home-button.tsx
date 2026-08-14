"use client"

import { LayoutGrid } from "lucide-react"
import Link from "next/link"
import type { FunctionComponent } from "react"
import { DefaultMenuPanel } from "tldraw"
import AwsIconPicker from "@/components/tools/draw/aws-icon-picker"

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

    <AwsIconPicker/>
  </div>
)

export default HomeButton
