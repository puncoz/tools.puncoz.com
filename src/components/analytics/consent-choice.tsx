"use client"

import { type FunctionComponent, useSyncExternalStore } from "react"
import Button from "@/components/ui/button"
import {
  clearConsent,
  getConsentSnapshot,
  getServerConsentSnapshot,
  setConsent,
  subscribeConsent,
} from "@/lib/ui/consent"

/**
 * The current cookie choice and a way out of it, for the privacy page.
 *
 * A policy that says "to change your mind, clear this site's data" is a policy
 * that expects nobody to change their mind. Withdrawing consent has to be as
 * easy as giving it, and this is the only page anyone would think to look.
 *
 * Rendered by the privacy page only when a measurement id is configured, so it
 * never offers to manage a decision that has no effect.
 */
const ConsentChoice: FunctionComponent = () => {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot,
  )

  // Undefined means the server snapshot — the real answer arrives on hydration.
  if (consent === undefined) {
    return null
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      {/* A `<span>`, not a `<p>`: this renders inside the privacy page's prose,
          whose `[&_p]` rule sets a top margin that would knock it out of line
          with the buttons — and being a descendant selector, it outranks any
          utility placed here to undo it. */}
      <span className="min-w-48 flex-1 text-sm">
        {consent === "granted" && "Analytics is on. You accepted it."}
        {consent === "denied" && "Analytics is off. You declined it."}
        {consent === null && "You have not answered yet, so analytics is off."}
      </span>

      {consent === "granted"
        ? (
          <Button size="sm" onClick={() => setConsent("denied")}>
            Turn analytics off
          </Button>
        )
        : (
          <Button variant="primary" size="sm" onClick={() => setConsent("granted")}>
            Turn analytics on
          </Button>
        )}

      {consent !== null && (
        <Button variant="ghost" size="sm" onClick={clearConsent}>
          Ask me again
        </Button>
      )}
    </div>
  )
}

export default ConsentChoice
