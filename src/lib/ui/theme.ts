/**
 * Theme preference, shared between the pre-paint script and the toggle.
 *
 * "system" is a real third state, not the absence of a choice: the toggle has to
 * be able to say "follow the OS" after the user has previously pinned light or
 * dark, which a boolean cannot express.
 */

const THEMES = ["light", "dark", "system"] as const

type Theme = typeof THEMES[number]

/** Also read by `themeScript` below — keep the two in step. */
const THEME_STORAGE_KEY = "theme"

const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && (THEMES as readonly string[]).includes(value)

const prefersDark = (): boolean =>
  window.matchMedia("(prefers-color-scheme: dark)").matches

const resolveTheme = (theme: Theme): "light" | "dark" =>
  theme === "system" ? (prefersDark() ? "dark" : "light") : theme

/** Applies a resolved theme to the document. The class is what the CSS keys on. */
const applyTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark")
}

const readStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)

    return isTheme(stored) ? stored : "system"
  } catch {
    // Private browsing and blocked storage both throw on read. Following the
    // system is the right answer when we cannot know the preference.
    return "system"
  }
}

const storeTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // The class is applied either way; only persistence is lost.
  }
}

/**
 * A store rather than component state, for two reasons.
 *
 * The preference lives in `localStorage`, which is an external system — reading
 * it into state inside an effect is the cascading-render pattern React now warns
 * about, and `useSyncExternalStore` is the sanctioned way to subscribe to one.
 * It also makes cross-tab sync fall out for free: the `storage` event fires in
 * every *other* tab, so changing the theme in one moves all of them.
 *
 * `getServerSnapshot` returns null because the server cannot know the
 * preference. The toggle renders with nothing selected for that first pass and
 * React re-renders with the real value immediately after hydration.
 */
let current: Theme | null = null

const listeners = new Set<() => void>()

const emitTheme = () => {
  for (const listener of listeners) {
    listener()
  }
}

const onStorage = (event: StorageEvent) => {
  if (event.key !== null && event.key !== THEME_STORAGE_KEY) {
    return
  }

  current = readStoredTheme()
  applyTheme(current)
  emitTheme()
}

const subscribeTheme = (listener: () => void): (() => void) => {
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage)
  }

  listeners.add(listener)

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage)
    }
  }
}

const getThemeSnapshot = (): Theme => current ?? (current = readStoredTheme())

/** The server has no `localStorage`; null means "not known yet". */
const getServerThemeSnapshot = (): Theme | null => null

/** The one way to change the theme: persists, applies, and notifies. */
const setTheme = (next: Theme): void => {
  current = next
  storeTheme(next)
  applyTheme(next)
  emitTheme()
}

/**
 * Runs before the page paints, so a dark-mode user never sees a white flash.
 *
 * Deliberately a string of hand-written ES5 rather than a bundled module: it has
 * to execute synchronously ahead of React, before hydration and before any
 * stylesheet-driven paint, and anything the bundler owns is by definition too
 * late. It is inlined into `<body>`'s first child in the root layout.
 *
 * It is also why `<html>` carries `suppressHydrationWarning` — this mutates the
 * class list before React sees the DOM, which React would otherwise report as a
 * server/client mismatch.
 */
const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light"&&t!=="dark")t="system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`

export {
  applyTheme,
  getServerThemeSnapshot,
  getThemeSnapshot,
  isTheme,
  prefersDark,
  readStoredTheme,
  resolveTheme,
  setTheme,
  storeTheme,
  subscribeTheme,
  THEME_STORAGE_KEY,
  THEMES,
  themeScript,
}
export type { Theme }
