"use client"

import { type FunctionComponent, useState } from "react"
import {
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  type Editor,
  loadSnapshot,
  Tldraw,
  type TLComponents,
} from "tldraw"
import { createAssetStore } from "@/components/tools/draw/asset-store"
import { DrawingContext } from "@/components/tools/draw/drawing-context"
import { customShapeUtils } from "@/components/tools/draw/shapes"
import { clientConfig } from "@/config/client"
import HomeButton from "@/components/tools/draw/home-button"
import ProjectMenu from "@/components/tools/draw/project-menu"
import SharePanel from "@/components/tools/draw/share-panel"
import { useAutosave } from "@/components/tools/draw/use-autosave"
import { useThumbnail } from "@/components/tools/draw/use-thumbnail"
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
    hasThumbnail: boolean
    isShared: boolean
  }
}>

const DrawCanvas: FunctionComponent<Props> = ({ drawing }) => {
  // Built once per mount. The store is seeded before first paint so the canvas
  // never flashes empty, and loading here rather than in onMount keeps the
  // initial document out of the undo history.
  const [store] = useState(() => {
    const created = createTLStore({
      // Must match `shared-canvas.tsx` — see the note in `shapes/index.ts`.
      shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
      bindingUtils: defaultBindingUtils,
      // Sends images to the user's own bucket instead of embedding them as
      // base64 in the document.
      assets: createAssetStore(),
    })

    if (isSnapshot(drawing.document)) {
      loadSnapshot(created, drawing.document as Parameters<typeof loadSnapshot>[1])
    }

    return created
  })

  // Only the thumbnail hook needs the editor itself; everything else works off
  // the store, which exists before tldraw mounts.
  const [editor, setEditor] = useState<Editor | null>(null)

  const saveState = useAutosave(store, drawing.id)

  useThumbnail(editor, store, drawing.id, drawing.hasThumbnail)

  return (
    <DrawingContext.Provider
      value={{
        id: drawing.id,
        title: drawing.title,
        saveState,
        isShared: drawing.isShared,
      }}
    >
      {/* The marker `main.css` looks for to stop swipe-to-go-back. */}
      <div data-canvas-surface className="fixed inset-0">
        <Tldraw
          store={store}
          shapeUtils={customShapeUtils}
          components={components}
          licenseKey={clientConfig.tldraw.licenseKey}
          onMount={setEditor}
        />
      </div>
    </DrawingContext.Provider>
  )
}

export default DrawCanvas
