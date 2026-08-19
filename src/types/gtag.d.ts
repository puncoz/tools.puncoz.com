/**
 * Minimal typing for the global Google installs on `window`.
 *
 * Hand-written rather than pulling in `@types/gtag.js`: three call shapes are
 * used in this app and a dependency for that is not worth the supply chain.
 *
 * `gtag` is optional because it only exists once the inline bootstrap in
 * `lib/ui/consent.ts` has run, which is never on a page with no measurement id
 * configured — so every call site has to cope with its absence.
 */
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: {
      (command: "consent", action: "default" | "update", params: Record<string, unknown>): void
      (command: "config", targetId: string, params?: Record<string, unknown>): void
      (command: "event", eventName: string, params?: Record<string, unknown>): void
      (command: "js", date: Date): void
    }
  }
}

export {}
