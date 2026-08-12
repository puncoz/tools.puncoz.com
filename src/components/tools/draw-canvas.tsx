"use client"

import { type FunctionComponent, useState } from "react"
import {
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  loadSnapshot,
  Tldraw,
  type TLComponents,
} from "tldraw"
import { DrawingContext } from "@/components/tools/draw/drawing-context"
import HomeButton from "@/components/tools/draw/home-button"
import ProjectMenu from "@/components/tools/draw/project-menu"
import SharePanel from "@/components/tools/draw/share-panel"
import { useAutosave } from "@/components/tools/draw/use-autosave"
import "tldraw/tldraw.css"

/**
 * Custom chrome injected into tldraw's own floating UI zones instead of a header
 * bar above the canvas — the canvas stays full-bleed and loses no space.
 *
 * Defined at module scope: a new object each render would remount every panel.
 */
const components: TLComponents = {
  MenuPanel: HomeButton,
  TopPanel: ProjectMenu,
  SharePanel,
}

/** A freshly created drawing stores `{}`; only a real snapshot has a `store` key. */
const isSnapshot = (document: unknown): boolean =>
  typeof document === "object" && document !== null && "store" in document

type Props = Readonly<{
  drawing: {
    id: string
    title: string
    document: unknown
  }
}>

const DrawCanvas: FunctionComponent<Props> = ({ drawing }) => {
  // Built once per mount. The store is seeded before first paint so the canvas
  // never flashes empty, and loading here rather than in onMount keeps the
  // initial document out of the undo history.
  const [store] = useState(() => {
    const created = createTLStore({
      shapeUtils: defaultShapeUtils,
      bindingUtils: defaultBindingUtils,
    })

    if (isSnapshot(drawing.document)) {
      loadSnapshot(created, drawing.document as Parameters<typeof loadSnapshot>[1])
    }

    return created
  })

  const saveState = useAutosave(store, drawing.id)

  return (
    <DrawingContext.Provider value={{ id: drawing.id, title: drawing.title, saveState }}>
      <div className="fixed inset-0">
        <Tldraw store={store} components={components}/>
      </div>
    </DrawingContext.Provider>
  )
}

export default DrawCanvas
