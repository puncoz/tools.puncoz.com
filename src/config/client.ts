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
    /** Browser tab and metadata title, and the tail of every page title. */
    name: "Dev Tools",
    /**
     * Short form, for places with no room for a sentence: the installed PWA name
     * and the corner of the share card. Page headers use the wordmark image
     * instead — see `components/ui/logo.tsx`.
     */
    shortName: "puncoz/tools",
    /** Landing page tagline, also the metadata description. */
    tagline: "A personal toolbox",
    description:
      "A small collection of tools I built for myself — diagrams, notes and whatever comes next.",
    /**
     * The address the legal pages publish for privacy, deletion and account
     * requests. Defined here so both documents and the footer quote the same
     * one — a policy that promises a channel nobody reads is worse than no
     * policy, so this must stay an address that actually receives mail.
     */
    contactEmail: "info@puncoz.com",
    /**
     * Canonical origin, used as `metadataBase` so Open Graph and icon URLs
     * resolve absolutely. Hardcoded rather than read from the environment: a
     * preview deployment advertising itself as canonical is worse than one
     * pointing at production.
     */
    url: "https://tools.puncoz.com",
    /** The logo blue. Also the browser/OS theme colour — see `layout.tsx`. */
    brandColor: "#567F95",
  },

  workos: {
    /** Public by definition — it is a URL the browser is redirected to. */
    redirectUri: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? "",
  },

  /**
   * All optional, and all deliberately absent from `REQUIRED_ENV_VARS`: a
   * checkout with none of these set must run normally, just unmeasured. Each is
   * empty-string-when-unset rather than undefined so call sites can test truthiness
   * without caring which.
   */
  analytics: {
    /**
     * GA4 measurement id, `G-XXXXXXXXXX`. Empty disables Google Analytics
     * entirely — no script, no consent banner, nothing in the page.
     *
     * `NEXT_PUBLIC_` by necessity: gtag runs in the browser and the id is in
     * every request it makes. It is not a secret, and cannot be one.
     */
    googleAnalyticsId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",
  },

  /** Ownership proofs for the search consoles. Meta tags, so public by design. */
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
    bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? "",
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
