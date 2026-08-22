"use client"

import dynamic from "next/dynamic"
import type { ComponentProps, FunctionComponent } from "react"
import CanvasSkeleton from "@/components/tools/draw/canvas-skeleton"
import type SharedCanvasType from "@/components/tools/draw/shared-canvas"

/**
 * The share view's half of ADR 0009 — see `draw-canvas-loader.tsx` for why this
 * wrapper has to be a client module at all (`ssr: false` throws in a server
 * component, and a server component's dynamic import of a client component does
 * not code split).
 *
 * Worth the separate module rather than a shared one taking a component: this is
 * the page a stranger reaches from a pasted link, with no warm cache and no
 * prior visit to have downloaded tldraw. It is the route where the skeleton
 * matters most, and its chrome is a different shape from the editor's.
 */
const SharedCanvas = dynamic(() => import("@/components/tools/draw/shared-canvas"), {
  ssr: false,
  loading: () => <CanvasSkeleton readOnly/>,
})

/** Mirrors the viewer's own props, so the page passes exactly what it did before. */
type Props = ComponentProps<typeof SharedCanvasType>

const SharedCanvasLoader: FunctionComponent<Props> = ({ token, document }) => (
  <SharedCanvas token={token} document={document}/>
)

export default SharedCanvasLoader
