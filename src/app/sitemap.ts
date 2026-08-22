import type { MetadataRoute } from "next"
import { clientConfig } from "@/config/client"

/**
 * Four pages, and that is the honest total.
 *
 * Everything else either needs a session — the tools, settings, account, admin —
 * or is explicitly disallowed in `robots.ts` because it must never be indexed:
 * `/s/` share links are public but a search result for someone's private drawing
 * is a categorically worse exposure than the link they chose to hand out.
 *
 * Listing a page a crawler will be redirected away from is worse than omitting
 * it, so the auth-gated routes are absent rather than present with a low
 * priority.
 */
const sitemap = (): MetadataRoute.Sitemap => {
  const base = clientConfig.app.url

  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/credits`, changeFrequency: "yearly", priority: 0.3 },
  ]
}

export default sitemap
