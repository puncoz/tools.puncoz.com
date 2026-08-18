/**
 * Low-level env access. Nothing outside `src/config` and `instrumentation.ts`
 * should import this — application code reads `serverConfig` / `clientConfig`.
 *
 * Server-side by nature: it looks env vars up dynamically, and Next.js only
 * inlines `NEXT_PUBLIC_*` vars that are referenced statically, so a dynamic
 * lookup always yields `undefined` in a client bundle.
 */

/**
 * Every variable the app cannot run without. Validated once at boot by
 * `instrumentation.ts` — this list is the single place to update when a new one
 * is added, so no entry point needs its own check.
 */
const REQUIRED_ENV_VARS = [
  "WORKOS_API_KEY",
  "WORKOS_CLIENT_ID",
  "WORKOS_COOKIE_PASSWORD",
  "NEXT_PUBLIC_WORKOS_REDIRECT_URI",
  "DATABASE_URL",
  // Without this nobody is an admin, so no pending user could ever be approved
  // and the site would be permanently closed. Failing at boot is far kinder than
  // discovering that from a locked-out account.
  "ADMIN_EMAILS",
] as const

const requireEnv = (name: string): string => {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See .env.example.`)
  }

  return value
}

/**
 * Fails fast at server startup, naming every missing variable at once rather
 * than surfacing one opaque API error per request. AuthKit in particular reads
 * its own env vars and falls back to empty strings, so without this a
 * misconfiguration only shows up as a confusing failure mid sign-in.
 */
const assertRequiredEnv = (): void => {
  const missing = REQUIRED_ENV_VARS.filter(name => !process.env[name])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}.\n`
      + "Copy .env.example to .env.local and fill these in.",
    )
  }
}

export { assertRequiredEnv, requireEnv }
