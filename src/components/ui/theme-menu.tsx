"use client"

import { Check, Monitor, Moon, Sun } from "lucide-react"
import { type FunctionComponent, useEffect, useSyncExternalStore } from "react"
import { buttonClasses } from "@/components/ui/button"
import { MENU_ITEM, MENU_SURFACE, useDismissableMenu } from "@/components/ui/menu"
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

type Props = Readonly<{
  /** Menu surface, for the canvas where it has to out-stack tldraw's panels. */
  surfaceClassName?: string
  /** Wrapper, for the canvas where tldraw's zones are pointer-events-none. */
  className?: string
}>

/**
 * Light / dark / follow-system, behind one button.
 *
 * Previously three buttons side by side, which put three of the header's five
 * controls on one setting nobody changes twice a day.
 *
 * The preference lives in `localStorage`, so the server cannot know it: the
 * trigger shows the system icon until the component mounts. Guessing a specific
 * mode server-side would flash the wrong icon on every load.
 *
 * The class on `<html>` is already correct by this point — the pre-paint script
 * in the root layout put it there. This only changes it afterwards.
 */
const ThemeMenu: FunctionComponent<Props> = ({ surfaceClassName, className }) => {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot)
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()

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

  const active = OPTIONS.find(option => option.value === theme) ?? OPTIONS[2]
  const TriggerIcon = active.Icon

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${active.label}`}
        title={`Theme: ${active.label}`}
        className={buttonClasses({ variant: "ghost", size: "icon" })}
      >
        <TriggerIcon className="size-4" aria-hidden="true"/>
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            MENU_SURFACE,
            "absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden py-1",
            surfaceClassName,
          )}
        >
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value)
                setOpen(false)
              }}
              className={MENU_ITEM}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true"/>
              <span className="flex-1">{label}</span>

              {theme === value && <Check className="size-3.5 shrink-0 text-brand" aria-hidden="true"/>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ThemeMenu
