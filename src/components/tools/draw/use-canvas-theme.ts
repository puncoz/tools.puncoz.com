"use client"

import { useEffect } from "react"
import type { Editor } from "tldraw"

/**
 * Keeps the canvas in the same theme as the page around it.
 *
 * tldraw has its own light/dark state and defaults to light, so without this the
 * canvas stays white inside a dark shell — the single most obvious way a themed
 * app can look broken.
 *
 * Watches the `dark` class on `<html>` rather than subscribing to our own theme
 * store, because that class is the source of truth: it is written by the
 * pre-paint script in the root layout, by the header toggle, and by the
 * system-preference listener, and only one of those three is React.
 */
const useCanvasTheme = (editor: Editor | null): void => {
  useEffect(() => {
    if (!editor) {
      return
    }

    const sync = () => {
      editor.setColorMode(document.documentElement.classList.contains("dark") ? "dark" : "light")
    }

    sync()

    const observer = new MutationObserver(sync)

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    return () => observer.disconnect()
  }, [editor])
}

export { useCanvasTheme }
