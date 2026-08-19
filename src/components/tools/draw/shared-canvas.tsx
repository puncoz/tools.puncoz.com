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
import { createSharedAssetStore } from "@/components/tools/draw/shared-asset-store"
import { customShapeUtils } from "@/components/tools/draw/shapes"
import { clientConfig } from "@/config/client"
import "tldraw/tldraw.css"

/**
 * Editing chrome removed outright rather than disabled. Read-only mode already
 * hides most of it, but leaving the zones empty means there is nothing to click
 * even if a future tldraw release changes what read-only suppresses.
 */
const components: TLComponents = {
  MenuPanel: null,
  TopPanel: null,
  SharePanel: null,
  Toolbar: null,
  StylePanel: null,
  PageMenu: null,
  ActionsMenu: null,
  QuickActions: null,
  HelperButtons: null,
  DebugPanel: null,
  ContextMenu: null,
}

/** A freshly created drawing stores `{}`; only a real snapshot has a `store` key. */
const isSnapshot = (document: unknown): boolean =>
  typeof document === "object" && document !== null && "store" in document

type Props = Readonly<{
  token: string
  document: unknown
}>

/**
 * The canvas behind a share link.
 *
 * Read-only is enforced by what is absent, not by what is hidden: no autosave
 * hook, no thumbnail hook, and no write route that accepts a share token. The
 * `isReadonly` flag below is tldraw's own read-only mode, which keeps pan, zoom
 * and copy working while refusing edits.
 */
const SharedCanvas: FunctionComponent<Props> = ({ token, document }) => {
  const [store] = useState(() => {
    const created = createTLStore({
      // Must match `draw-canvas.tsx` — see the note in `shapes/index.ts`. If this
      // drifts, shared diagrams containing AWS icons fail to load for visitors.
      shapeUtils: [...defaultShapeUtils, ...customShapeUtils],
      bindingUtils: defaultBindingUtils,
      assets: createSharedAssetStore(token),
    })

    if (isSnapshot(document)) {
      loadSnapshot(created, document as Parameters<typeof loadSnapshot>[1])
    }

    return created
  })

  const onMount = (editor: Editor) => {
    editor.updateInstanceState({ isReadonly: true })
    // Imported and shared drawings often sit well outside the default viewport,
    // so a visitor would otherwise open to empty canvas.
    editor.zoomToFit({ animation: { duration: 0 } })
  }

  return (
    <div data-canvas-surface className="fixed inset-0">
      <Tldraw
        store={store}
        shapeUtils={customShapeUtils}
        components={components}
        licenseKey={clientConfig.tldraw.licenseKey}
        onMount={onMount}
      />
    </div>
  )
}

export default SharedCanvas
