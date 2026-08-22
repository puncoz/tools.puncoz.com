"use client"

import { createShapeId, StateNode, type TLStateNodeConstructor, toRichText } from "tldraw"
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  type AnyIconShape,
} from "@/components/tools/draw/shapes/icon-shape-util"

/**
 * Click-to-place for provider icons.
 *
 * A tool rather than a one-shot `pointerdown` listener because placing is a
 * *mode*, and tldraw's state chart already runs modes. A hand-rolled version owns
 * every exit path itself — Escape, right-click, a pan that starts mid-placement,
 * the toolbar switching tools, the component unmounting with the listener still
 * attached — and each one missed is either a stuck crosshair or a listener that
 * fires on an unrelated click minutes later. See ADR 0011.
 *
 * The icon arrives through `setCurrentTool`'s second argument rather than through
 * a module-level store: tools are constructed once, not once per insertion, so
 * there is otherwise nowhere to put it. `onEnter` receives whatever was passed.
 */

const PLACE_ICON_TOOL_ID = "place-icon"

type PlaceIconInfo = {
  shapeType: AnyIconShape["type"]
  slug: string
  name: string
}

class PlaceIconTool extends StateNode {
  static override id = PLACE_ICON_TOOL_ID

  // Optimistic: a real invocation always supplies a full `PlaceIconInfo`. It is
  // typed as partial, and checked as partial in `onPointerDown`, because
  // `StateNode.transition` and `Editor.setCurrentTool` both default a missing
  // second argument to `{}`, not `undefined` — `editor.setCurrentTool("place-icon")`
  // alone still runs `onEnter({})`. A plain truthiness check on `this.pending`
  // therefore never sees the no-payload case: `{}` is truthy, and the object
  // exists from the first `onEnter` onward, so the "nothing to place" branch
  // could never be reached by any pointer event.
  private pending: Partial<PlaceIconInfo> | null = null

  override onEnter(info: Partial<PlaceIconInfo>) {
    this.pending = info
    this.editor.setCursor({ type: "cross" })
  }

  override onExit() {
    this.pending = null
    // Restoring the cursor here rather than in `onPointerDown` covers the
    // cancelled paths too, which is the whole point of using a state node.
    this.editor.setCursor({ type: "default" })
  }

  override onPointerDown() {
    const pending = this.pending

    if (!pending?.shapeType || !pending.slug) {
      // Checked on the required fields, not on the object: `onEnter` always
      // receives an object (see the field comment above), so `!pending` can
      // never be true here, and a bare truthiness check would silently let an
      // empty-payload invocation fall through to `createShape` with
      // `type: undefined` — which throws inside `getShapeUtil` — or with
      // `service: undefined`, which the shape's own prop validator rejects at
      // creation time. Either way the canvas breaks instead of cleanly
      // returning to `select`. `name` is not checked: an empty caption is a
      // valid shape, so it degrades instead of guarding.
      this.editor.setCurrentTool("select")

      return
    }

    // Centred on the click rather than the viewport, which is the entire reason
    // this mode exists: in a dense diagram the viewport centre is occupied.
    const { x, y } = this.editor.inputs.currentPagePoint
    const id = createShapeId()

    this.editor.createShape<AnyIconShape>({
      id,
      type: pending.shapeType,
      x: x - DEFAULT_WIDTH / 2,
      y: y - DEFAULT_HEIGHT / 2,
      props: {
        w: DEFAULT_WIDTH,
        h: DEFAULT_HEIGHT,
        service: pending.slug,
        // `name` is optional on `Partial<PlaceIconInfo>` and unchecked above;
        // an omitted caption is not an error state, just an empty one.
        richText: toRichText(pending.name ?? ""),
      },
    })

    this.editor.setCurrentTool("select")
    // Selected so it can be dragged or recaptioned without a second click.
    this.editor.select(id)
  }

  override onCancel() {
    this.editor.setCurrentTool("select")
  }

  override onInterrupt() {
    this.editor.setCurrentTool("select")
  }
}

/** Registered on the editable canvas only — the share view cannot insert. */
const customTools: readonly TLStateNodeConstructor[] = [PlaceIconTool]

export default PlaceIconTool
export { customTools, PLACE_ICON_TOOL_ID }
export type { PlaceIconInfo }
