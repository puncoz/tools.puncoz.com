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
import { PANEL_CLASSES } from "@/components/tools/draw/floating-menu"
import PageSwitcher from "@/components/tools/draw/page-switcher"
import { createSharedAssetStore } from "@/components/tools/draw/shared-asset-store"
import { customShapeUtils } from "@/components/tools/draw/shapes"
import { useCanvasTheme } from "@/components/tools/draw/use-canvas-theme"
import ThemeMenu from "@/components/ui/theme-menu"
import { clientConfig } from "@/config/client"
import "tldraw/tldraw.css"

/**
 * The visitor's own light/dark preference, in the same top-right corner and with
 * the same styling the editor gives it — see `share-panel.tsx` for why a bare
 * icon over a drawing does not work.
 *
 * Worth carrying into the read-only view rather than leaving to whatever the
 * visitor's system says: a shared drawing is often the only page of this site
 * someone ever sees, it is full-bleed canvas with no header to hold the control,
 * and a diagram drawn in one mode is not always legible in the other.
 */
const ThemeControl: FunctionComponent = () => (
  <ThemeMenu className={PANEL_CLASSES} surfaceClassName="z-[100000]"/>
)

/**
 * Editing chrome removed outright rather than disabled. Read-only mode already
 * hides most of it, but leaving the zones empty means there is nothing to click
 * even if a future tldraw release changes what read-only suppresses.
 *
 * The two exceptions are the controls a visitor does get, and neither can edit
 * anything: the page switcher, and the theme. `TopPanel` holds the switcher
 * centred, because the top-left corner belongs to the title and "Read-only"
 * badge that `s/[token]/page.tsx` pins over the canvas; `SharePanel` is the
 * top-right corner, where the editor keeps its own theme control.
 */
const components: TLComponents = {
  MenuPanel: null,
  TopPanel: PageSwitcher,
  SharePanel: ThemeControl,
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

  // Held only so the theme hook can reach the editor; nothing here reads it.
  const [editor, setEditor] = useState<Editor | null>(null)

  useCanvasTheme(editor)

  const onMount = (mounted: Editor) => {
    mounted.updateInstanceState({ isReadonly: true })
    // Imported and shared drawings often sit well outside the default viewport,
    // so a visitor would otherwise open to empty canvas.
    mounted.zoomToFit({ animation: { duration: 0 } })
    setEditor(mounted)
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
