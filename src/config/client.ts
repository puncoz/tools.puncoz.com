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
    name: "Tools | Puncoz Nepal",
    shortName: "tools.puncoz.com",
    description: "Some useful tools for developers.",
  },

  workos: {
    /** Public by definition — it is a URL the browser is redirected to. */
    redirectUri: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? "",
  },
} as const

export { clientConfig }
