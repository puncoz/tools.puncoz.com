/**
 * Next.js calls `register()` once per server instance, before any request is
 * served. Validating configuration here means each entry point can assume the
 * environment is sane, instead of asserting for itself.
 */
export const register = async (): Promise<void> => {
  // Also runs for the edge runtime, where `process.env` holds only what was
  // inlined at build time — checking there would produce false failures.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }

  // `next build` boots an instrumentation instance to collect page data. The
  // build must not require credentials, so skip validation during that phase.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return
  }

  const { assertRequiredEnv } = await import("@/config/env")

  assertRequiredEnv()
}
