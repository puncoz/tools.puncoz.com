"use client"

import { createContext, useContext } from "react"
import type { SaveState } from "@/components/tools/draw/use-autosave"

type DrawingContextValue = {
  id: string
  title: string
  saveState: SaveState
}

/**
 * tldraw instantiates the components passed via its `components` prop itself and
 * gives no way to pass props into them, so the panels read the current drawing
 * and save status from context instead. The provider sits above `<Tldraw>`.
 */
const DrawingContext = createContext<DrawingContextValue | null>(null)

const useDrawing = (): DrawingContextValue => {
  const value = useContext(DrawingContext)

  if (!value) {
    throw new Error("useDrawing must be used inside <DrawingContext.Provider>")
  }

  return value
}

export { DrawingContext, useDrawing }
export type { DrawingContextValue }
