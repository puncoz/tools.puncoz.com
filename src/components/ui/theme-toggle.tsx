"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { type FunctionComponent, useEffect, useSyncExternalStore } from "react"
import {
  applyTheme,
  getServerThemeSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
  type Theme,
} from "@/lib/ui/theme"
import { cn } from "@/lib/utils"

const OPTIONS: { value: Theme, label: string, Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
]

/**
 * Light / dark / follow-system.
 *
 * The preference lives in `localStorage`, so the server cannot know it: the
 * control renders with nothing selected for the first pass and fills in
 * immediately after hydration. Guessing "system" server-side would highlight the
 * wrong segment for a moment on every load, which is worse than showing none.
 *
 * The class itself is already on `<html>` by this point — the pre-paint script
 * in the root layout put it there. This only changes it afterwards.
 */
const ThemeToggle: FunctionComponent = () => {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot)

  // While following the system, the OS flipping at sunset has to be picked up
  // live — without this the page keeps yesterday's palette until a reload.
  useEffect(() => {
    if (theme !== "system") {
      return
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")

    media.addEventListener("change", onChange)

    return () => media.removeEventListener("change", onChange)
  }, [theme])

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center rounded-lg border border-border p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            theme === value
              ? "bg-brand-subtle text-brand"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true"/>
        </button>
      ))}
    </div>
  )
}

export default ThemeToggle
