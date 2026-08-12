"use client"

import { useSyncExternalStore } from "react"

/**
 * Global loading state for the top progress bar.
 *
 * Two independent sources feed it:
 *
 * - **Tasks** — a counter, so concurrent async work (rename + import) keeps the
 *   bar up until the last one finishes rather than the first.
 * - **Navigation** — a flag, because a route change completes when the new
 *   route renders, not when a promise resolves.
 *
 * A plain module store rather than context: `startTask` is called from event
 * handlers and plain async functions that are not inside the React tree.
 */

let taskCount = 0
let navigating = false

const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) {
    listener()
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

const isBusy = () => navigating || taskCount > 0

const startTask = () => {
  taskCount += 1
  emit()
}

const endTask = () => {
  taskCount = Math.max(0, taskCount - 1)
  emit()
}

const startNavigation = () => {
  if (!navigating) {
    navigating = true
    emit()
  }
}

const endNavigation = () => {
  if (navigating) {
    navigating = false
    emit()
  }
}

/**
 * Shows the bar for the duration of an async task.
 *
 * `finally` rather than a trailing call so a rejected task cannot strand the
 * bar on screen.
 */
const withProgress = async <T>(task: () => Promise<T>): Promise<T> => {
  startTask()

  try {
    return await task()
  } finally {
    endTask()
  }
}

/** Server snapshot is always false — the bar never renders during SSR. */
const useIsBusy = (): boolean => useSyncExternalStore(subscribe, isBusy, () => false)

export { endNavigation, endTask, startNavigation, startTask, useIsBusy, withProgress }
