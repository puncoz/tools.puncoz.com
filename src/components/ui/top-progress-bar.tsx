"use client"

import { usePathname } from "next/navigation"
import { type FunctionComponent, useEffect, useState } from "react"
import { endNavigation, startNavigation, useIsBusy } from "@/lib/ui/progress"

/** Creeps toward this but never reaches it — only completion fills the bar. */
const CEILING = 90

/** How long a navigation may stay pending before the bar gives up and hides. */
const NAVIGATION_TIMEOUT_MS = 15_000

const TICK_MS = 200

/**
 * A YouTube-style loading bar pinned to the top of the viewport.
 *
 * Progress is deliberately fake: the real duration is unknown, so it eases
 * toward 90% and only jumps to 100% on completion. That reads as responsive
 * without ever claiming to know how long something will take.
 */
const TopProgressBar: FunctionComponent = () => {
  const busy = useIsBusy()
  const pathname = usePathname()

  // One object rather than two states: every transition changes both together,
  // and it keeps the updates inside a single functional setState.
  const [bar, setBar] = useState({ visible: false, value: 0 })

  // A completed navigation is signalled by the new pathname rendering.
  useEffect(() => {
    endNavigation()
  }, [pathname])

  // Anchor clicks are caught globally rather than by wrapping every <Link>, so
  // any link added later is covered without being remembered.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Modified clicks open a new tab; the current page never navigates.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const anchor = (event.target as HTMLElement | null)?.closest?.("a")

      if (!anchor?.href || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return
      }

      const target = new URL(anchor.href)

      // Cross-origin leaves the app entirely, and a same-URL click re-renders
      // nothing — neither should show progress.
      if (target.origin !== window.location.origin || target.href === window.location.href) {
        return
      }

      startNavigation()
    }

    document.addEventListener("click", onClick, true)

    return () => {
      document.removeEventListener("click", onClick, true)
    }
  }, [])

  // Safety net: a navigation that never resolves (blocked, or a link that did
  // not actually route) must not pin the bar on screen forever.
  useEffect(() => {
    if (!busy) {
      return
    }

    const timeout = setTimeout(endNavigation, NAVIGATION_TIMEOUT_MS)

    return () => clearTimeout(timeout)
  }, [busy])

  // Every update runs from a timer rather than the effect body: a synchronous
  // setState inside an effect triggers a cascading render.
  useEffect(() => {
    if (busy) {
      const kickoff = setTimeout(() => {
        setBar(current => ({
          visible: true,
          value: current.value === 0 || current.value >= CEILING ? 8 : current.value,
        }))
      }, 0)

      // Each tick closes a fraction of the remaining distance, so the bar
      // decelerates as it approaches the ceiling.
      const interval = setInterval(() => {
        setBar(current => current.visible
          ? { ...current, value: current.value + Math.max(0.4, (CEILING - current.value) * 0.12) }
          : current)
      }, TICK_MS)

      return () => {
        clearTimeout(kickoff)
        clearInterval(interval)
      }
    }

    // Returning `current` unchanged lets React bail out, so an idle mount does
    // not re-render.
    const complete = setTimeout(() => {
      setBar(current => (current.visible ? { ...current, value: 100 } : current))
    }, 0)

    // Long enough for the fill-to-100% transition to be seen before fading.
    const hide = setTimeout(() => {
      setBar(current => (current.visible ? { visible: false, value: 0 } : current))
    }, 320)

    return () => {
      clearTimeout(complete)
      clearTimeout(hide)
    }
  }, [busy])

  if (!bar.visible) {
    return null
  }

  return (
    <div
      // Above tldraw, which layers its own panels up to 99999 and this app's
      // floating menus at 100000.
      className="pointer-events-none fixed inset-x-0 top-0 z-[100002] h-0.5"
      // Decorative: route changes are already announced by the content itself,
      // and a value updating five times a second would be noise.
      aria-hidden="true"
    >
      <div
        className="h-full bg-primary transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${Math.min(bar.value, 100)}%`, opacity: bar.value >= 100 ? 0 : 1 }}
      />
    </div>
  )
}

export default TopProgressBar
