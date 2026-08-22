"use client"

import dynamic from "next/dynamic"
import type { ComponentProps, FunctionComponent } from "react"
import CanvasSkeleton from "@/components/tools/draw/canvas-skeleton"
import type DrawCanvasType from "@/components/tools/draw-canvas"

/**
 * Loads the editor out of the critical path, behind a skeleton (ADR 0009).
 *
 * This wrapper exists for two reasons that are both properties of Next 16 rather
 * than of this app, and both documented in
 * `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`:
 *
 * 1. **`ssr: false` is not allowed in a Server Component** — it throws. So the
 *    call has to sit inside a `"use client"` module even though the page that
 *    renders it is a server component.
 * 2. **A Server Component dynamically importing a Client Component does not code
 *    split at all.** Doing this from `page.tsx` would have produced the skeleton
 *    and none of the benefit: tldraw would still have been in the route's
 *    initial chunk.
 *
 * `ssr: false` rather than the default: tldraw needs real layout measurement, so
 * what it renders on the server is a placeholder that is discarded on hydration.
 * Paying to serialise it and ship it is strictly worse than rendering our own
 * placeholder, which we control the look of. The skeleton is what gets
 * prerendered into the HTML in its place.
 */
const DrawCanvas = dynamic(() => import("@/components/tools/draw-canvas"), {
  ssr: false,
  loading: () => <CanvasSkeleton/>,
})

/** Mirrors the editor's own props, so the page passes exactly what it did before. */
type Props = ComponentProps<typeof DrawCanvasType>

const DrawCanvasLoader: FunctionComponent<Props> = ({ drawing }) => (
  <DrawCanvas drawing={drawing}/>
)

export default DrawCanvasLoader
