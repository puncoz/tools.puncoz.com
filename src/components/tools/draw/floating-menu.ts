"use client"

import { MENU_SURFACE, useDismissableMenu } from "@/components/ui/menu"

/**
 * The bits of menu styling that are specific to floating over a tldraw canvas.
 *
 * The behaviour itself — dismiss on outside click or Escape — lives in
 * `components/ui/menu.ts` and is shared with the site header. Only the two
 * constants below are canvas-specific, and only for one reason each.
 */

/**
 * Surface styling for the floating controls injected into tldraw. `card` rather
 * than `popover` because these sit *on* the canvas as permanent chrome rather
 * than appearing over it, and `pointer-events-auto` because tldraw's zones are
 * pointer-events-none so the canvas underneath stays drawable.
 */
const PANEL_CLASSES = "pointer-events-auto rounded-lg border border-border bg-card text-card-foreground shadow-sm"

/**
 * Dropdown surface. The z-index is deliberately extreme: tldraw layers its own
 * panels up to 99999, and the style panel sits in the same top-right corner as
 * the account menu — without this the dropdown renders behind it. That number is
 * the entire reason this is not just `MENU_SURFACE`.
 */
const DROPDOWN_CLASSES = `pointer-events-auto ${MENU_SURFACE} absolute top-full z-[100000] mt-1 overflow-hidden py-1`

export { DROPDOWN_CLASSES, PANEL_CLASSES, useDismissableMenu }
