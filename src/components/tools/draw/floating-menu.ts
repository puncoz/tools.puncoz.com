"use client"

import { useEffect, useRef, useState } from "react"

/** Surface styling shared by the floating controls injected into tldraw. */
const PANEL_CLASSES = "pointer-events-auto rounded-lg border border-border bg-card text-card-foreground shadow-sm"

/**
 * Dropdown surface. The z-index is deliberately extreme: tldraw layers its own
 * panels up to 99999, and the style panel sits in the same top-right corner as
 * the account menu — without this the dropdown renders behind it.
 */
const DROPDOWN_CLASSES = `${PANEL_CLASSES} absolute top-full z-[100000] mt-1 overflow-hidden py-1 shadow-md`

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

export { DROPDOWN_CLASSES, PANEL_CLASSES, useDismissableMenu }
