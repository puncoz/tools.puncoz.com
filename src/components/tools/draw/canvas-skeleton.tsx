import type { FunctionComponent } from "react"
import { PANEL_CLASSES } from "@/components/tools/draw/floating-menu"
import { cn } from "@/lib/utils"

/**
 * What the canvas routes paint while tldraw is still downloading.
 *
 * Both canvas pages render one component and nothing else, so before this
 * existed their First Contentful Paint *was* tldraw finishing its download,
 * parse and hydration — ~780KB of JavaScript and a second render-blocking
 * stylesheet, measured at 4.8s on `/draw/[id]`. There was simply nothing on the
 * page to paint sooner. See ADR 0009.
 *
 * Deliberately a skeleton and not a spinner. The panels are drawn in the
 * positions tldraw will inject the real ones into, so the swap reads as a fill
 * rather than a reflow, and a reader knows what is arriving. A spinner would
 * score identically and feel worse.
 *
 * MUST be kept in visual step with the real chrome — `home-button.tsx` top left,
 * `project-menu.tsx` top centre, `share-panel.tsx` top right, tldraw's own
 * toolbar bottom centre. Nothing enforces that and no test will catch a drift;
 * the symptom is a jump at the moment the canvas appears.
 */

/**
 * The drawing's title is deliberately not a prop, even though the page knows it.
 * `next/dynamic`'s `loading` option is called with no arguments, so a per-render
 * value would mean building the lazy component inside the render — which
 * remounts the editor every time — or threading a context through purely to
 * decorate a placeholder. Neither is worth a word the tab title already shows.
 *
 * A *constant* is fine, because each loader module declares its own `loading`
 * closure and can pass literals. Hence `readOnly` below.
 */

type Props = Readonly<{
  /**
   * The share view's chrome, which is a different shape: `shared-canvas.tsx`
   * sets `MenuPanel: null` and `Toolbar: null`, leaving only the centred page
   * switcher and the theme control. Drawing the editor's full chrome there
   * would promise buttons that never arrive.
   */
  readOnly?: boolean
}>

/** A panel-shaped placeholder. `animate-pulse` is on the parent, not on each. */
const Block: FunctionComponent<{ className?: string }> = ({ className }) => (
  <div className={cn("rounded-lg bg-muted-foreground/15", className)}/>
)

const CanvasSkeleton: FunctionComponent<Props> = ({ readOnly = false }) => (
  <div
    // Matches the real surface's positioning so the two occupy identical space.
    data-canvas-surface
    className="fixed inset-0 bg-background"
    // The canvas is decorative until it loads; the title beside it is already
    // announced by the page's own metadata, so this is noise to a screen reader.
    aria-hidden="true"
  >
    <div className="absolute inset-0 animate-pulse">
      {/* Top left — the home button and icon pickers. Absent on the share view,
          where the corner belongs to the title and "Read-only" badge that
          `s/[token]/page.tsx` pins over the canvas itself. */}
      {!readOnly && (
        <div className="absolute left-3 top-3 flex items-center gap-1">
          <Block className="size-9"/>
          <Block className="size-9"/>
          <Block className="size-9"/>
        </div>
      )}

      {/* Top centre — the project menu. Drawn as a real panel rather than a bare
          block so the one piece of chrome the reader looks at first has its
          final shape from the start. */}
      <div className={cn(
        PANEL_CLASSES,
        "absolute left-1/2 top-3 flex h-9 -translate-x-1/2 items-center gap-2 px-3",
      )}
      >
        <Block className="h-3.5 w-28"/>
      </div>

      {/* Top right — share, theme and account in the editor; the theme control
          alone on the share view. */}
      <div className="absolute right-3 top-3 flex items-center gap-1">
        {!readOnly && <Block className="h-9 w-20"/>}
        <Block className="size-9"/>
        {!readOnly && <Block className="size-9"/>}
      </div>

      {/* Bottom centre — tldraw's toolbar, which the share view removes. */}
      {!readOnly && (
        <Block className="absolute bottom-3 left-1/2 h-12 w-[min(30rem,90vw)] -translate-x-1/2"/>
      )}
    </div>
  </div>
)

export default CanvasSkeleton
