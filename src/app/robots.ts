import type { MetadataRoute } from "next"

/**
 * Share links are reachable without signing in, which makes them crawlable the
 * moment anyone posts one anywhere public. Getting a drawing into a search index
 * is a categorically worse exposure than the one the owner opted into, so `/s/`
 * is disallowed here, tagged `noindex` on the page, and sent with an
 * `X-Robots-Tag` header from `next.config.ts`.
 */
const robots = (): MetadataRoute.Robots => ({
  rules: [{ userAgent: "*", disallow: ["/s/", "/api/", "/auth/", "/settings/"] }],
})

export default robots
