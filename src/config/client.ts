/**
 * Configuration safe to reach the browser. Deliberately has no `server-only`
 * import so it can be used from either side.
 *
 * Only `NEXT_PUBLIC_*` env vars belong here, and each must be referenced as a
 * full static `process.env.NEXT_PUBLIC_X` expression — that literal text is
 * what Next.js substitutes at build time. A dynamic lookup would compile to
 * `undefined` in the client bundle.
 *
 * Never add a secret to this file. Anything here is shipped to users.
 */
const clientConfig = {
  app: {
    /** Browser tab and metadata title. */
    name: "Puncoz Tools",
    /** Wordmark in page headers. */
    shortName: "puncoz/tools",
    /** Landing page tagline, also the metadata description. */
    tagline: "A personal toolbox",
    description:
      "A small collection of tools I built for myself — diagrams, notes and whatever comes next.",
  },

  workos: {
    /** Public by definition — it is a URL the browser is redirected to. */
    redirectUri: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? "",
  },

  tldraw: {
    /**
     * Public by design, and the exception that proves the rule above.
     *
     * tldraw validates its licence in the browser, so the key has to reach the
     * client and is meant to be readable there — it is a licence assertion, not
     * a credential. It buys nobody anything they could not already do.
     *
     * Optional: without it tldraw still works and simply logs a warning about
     * production use, so a checkout with no key runs fine.
     */
    licenseKey: process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY ?? "",
  },
} as const

export { clientConfig }
