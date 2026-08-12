/** Any absolute URL resolving to this origin means the input was origin-relative. */
const INTERNAL_ORIGIN = "https://internal.invalid"

/**
 * Reduces an untrusted `returnTo` value to a same-origin path, or "/".
 *
 * `returnTo` arrives from the query string and is emitted in a `Location`
 * header, so an unvalidated value is an open redirect (CWE-601).
 *
 * A `startsWith("/") && !startsWith("//")` check is NOT sufficient. WHATWG URL
 * parsing — which every browser applies to `Location` — treats backslashes as
 * forward slashes and strips tab/newline, so `/\evil.com`, `/\/evil.com` and
 * `/<tab>/evil.com` all navigate to evil.com while passing a naive prefix test.
 *
 * Parsing against a known origin and comparing the result is the reliable
 * check, because it applies the same normalisation the browser will.
 */
const safeReturnTo = (value: string | null | undefined): string => {
  if (!value) {
    return "/"
  }

  let candidate: URL

  try {
    candidate = new URL(value, INTERNAL_ORIGIN)
  } catch {
    return "/"
  }

  // Absolute ("https://evil.com"), protocol-relative ("//evil.com") and
  // backslash/whitespace variants all resolve to some other origin.
  if (candidate.origin !== INTERNAL_ORIGIN) {
    return "/"
  }

  const path = `${candidate.pathname}${candidate.search}${candidate.hash}`

  // Same-origin input can still normalise to a protocol-relative path:
  // "/..//evil.com" becomes "//evil.com", which escapes the origin once a
  // browser resolves it as a Location header.
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/"
  }

  return path
}

export { safeReturnTo }
