"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Dropdown menus, shared by the site header and the tldraw chrome.
 *
 * The hook and the surface both started life in `tools/draw/floating-menu.ts`,
 * written for panels injected into the canvas. They are not canvas-specific, and
 * the header needing the same behaviour is the second caller that proves it —
 * see that file for the one thing that genuinely is canvas-specific.
 */

/** The floating surface a menu is drawn on. */
const MENU_SURFACE = "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"

/** A row inside a menu: link, button, or a plain block of text. */
const MENU_ITEM = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50"

/**
 * Open/close state for a menu that dismisses on outside click or Escape.
 *
 * Listeners are attached in the capture phase: tldraw stops pointer events on
 * the canvas, so a bubbling listener would never see clicks landing outside.
 * They are only attached while open, so a closed menu costs nothing.
 */
const useDismissableMenu = <T extends HTMLElement>() => {
  const [open, setOpen] = useState(false)
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return { open, setOpen, ref }
}

export { MENU_ITEM, MENU_SURFACE, useDismissableMenu }
