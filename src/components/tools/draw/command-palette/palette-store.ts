"use client"

import { useEffect } from "react"
import type { Editor } from "tldraw"

/**
 * Open/closed state for the command palette, plus the `/` binding that opens it.
 *
 * A module store rather than component state for the same reason `lib/ui/theme.ts`
 * is one: the thing that changes the value — a `keydown` listener on `document` —
 * is outside React's tree and has no setter in scope. `useSyncExternalStore` is
 * the sanctioned way to subscribe to that.
 */

let open = false

const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) {
    listener()
  }
}

const subscribePalette = (listener: () => void): (() => void) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

const getPaletteSnapshot = (): boolean => open

/** The palette is never open during a server render. */
const getServerPaletteSnapshot = (): boolean => false

const setPaletteOpen = (next: boolean): void => {
  if (open === next) {
    return
  }

  open = next
  emit()
}

/**
 * Anything that accepts typed text. `closest` rather than a tag check so that a
 * click inside a rich-text editor's nested markup still counts as text entry —
 * tldraw's shape labels are a contenteditable, and the two picker search boxes
 * and the palette's own input are `<input>`s.
 */
const TEXT_ENTRY_SELECTOR = "input, textarea, select, [contenteditable=''], [contenteditable='true']"

const isTextEntry = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR) !== null

/**
 * Opens the palette on `/`, and only where a `/` is not text.
 *
 * Both failure directions are silent: too permissive and the palette opens while
 * you are typing a shape label, swallowing the slash; too strict and `/` does
 * nothing on the canvas. Neither throws and neither is caught by `tsc` or lint,
 * so the conditions are enumerated rather than condensed.
 *
 * Listening on `document` rather than the tldraw container is deliberate — `/`
 * has to work immediately after the route loads, while focus is still on `body`
 * and nothing has been clicked.
 */
const usePaletteShortcut = (editor: Editor | null): void => {
  useEffect(() => {
    if (!editor) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // `key` is the produced character, so layouts where `/` needs Shift work,
      // and `?` (Shift+/ on US) correctly does not match. Never test `code`.
      if (event.key !== "/") {
        return
      }

      // `cmd+/`, `ctrl+/` and `cmd+alt+/` are tldraw's own keyboard-shortcuts
      // actions. Stealing them would break the help dialog.
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      // An IME composition must not be interrupted. `229` is the legacy signal
      // for browsers where `isComposing` is unreliable — which is the only
      // reason `keyCode` appears here at all.
      if (event.isComposing || event.keyCode === 229) {
        return
      }

      if (event.defaultPrevented) {
        return
      }

      // The condition that keeps the slash typable.
      if (isTextEntry(event.target)) {
        return
      }

      // The editor's own notion of "a label is being edited". Redundant with the
      // check above in practice, kept because it is the semantic one and free.
      if (editor.getEditingShapeId() !== null) {
        return
      }

      if (getPaletteSnapshot()) {
        return
      }

      // Beyond tidiness: a bare `/` opens quick-find in Firefox.
      event.preventDefault()
      setPaletteOpen(true)
    }

    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [editor])
}

export {
  getPaletteSnapshot,
  getServerPaletteSnapshot,
  setPaletteOpen,
  subscribePalette,
  usePaletteShortcut,
}
