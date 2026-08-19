"use client"

import Link from "next/link"
import { type FunctionComponent, useSyncExternalStore } from "react"
import Button from "@/components/ui/button"
import {
  getConsentSnapshot,
  getServerConsentSnapshot,
  setConsent,
  subscribeConsent,
} from "@/lib/ui/consent"

/**
 * Asks once, then never again.
 *
 * Only shown while the answer is genuinely unknown. `undefined` means the server
 * has not yet been corrected by hydration and renders nothing — without that
 * distinction the banner would appear on every server-rendered page and vanish a
 * moment later, including for people who already declined.
 *
 * Declining is a real button rather than a dismiss X. A close control that
 * silently means "no" is the pattern that makes consent banners worthless, and
 * one that silently means "yes" is worse than worthless.
 */
const ConsentBanner: FunctionComponent = () => {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot,
  )

  if (consent !== null) {
    return null
  }

  return (
    <div
      role="region"
      aria-label="Cookie choice"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4"
    >
      <div className="flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-border bg-popover px-4 py-3 text-popover-foreground shadow-lg">
        <p className="min-w-48 flex-1 text-sm text-muted-foreground">
          This site uses Google Analytics to see how it is used. Nothing is stored until
          you agree.{" "}
          <Link href="/privacy" className="font-medium text-brand underline underline-offset-4">
            Privacy
          </Link>
        </p>

        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => setConsent("denied")}>
            Decline
          </Button>

          <Button variant="primary" size="sm" onClick={() => setConsent("granted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ConsentBanner
