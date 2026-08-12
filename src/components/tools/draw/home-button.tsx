"use client"

import { House } from "lucide-react"
import Link from "next/link"
import type { FunctionComponent } from "react"
import { DefaultMenuPanel } from "tldraw"

/**
 * Rendered into tldraw's `MenuPanel` zone (top-left).
 *
 * `DefaultMenuPanel` is rendered alongside rather than replaced, so tldraw's
 * own main menu, page menu and undo/redo keep working — this only adds a way
 * out of the canvas.
 */
const HomeButton: FunctionComponent = () => (
  <div className="flex items-center gap-1">
    <Link
      href="/"
      title="Back to tools"
      aria-label="Back to tools"
      className="pointer-events-auto flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
    >
      <House className="size-4" aria-hidden="true"/>
    </Link>

    <DefaultMenuPanel/>
  </div>
)

export default HomeButton
