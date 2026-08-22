import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The icons are declared as file conventions (`src/app/icon.png`), so nothing
  // answers the older `/favicon.ico` convention and it falls through to the
  // application's 404 — 22KB of HTML, rendered by a function, uncacheable, for a
  // request that wanted a 4KB image. Browsers that read the `<link rel="icon">`
  // never ask, but crawlers and unfurlers still do. Vercel resolves redirects in
  // its routing layer, so this is answered without invoking a function. See ADR 0007.
  redirects: async () => [
    {
      source: "/favicon.ico",
      destination: "/icon.png",
      permanent: true,
    },
  ],

  headers: async () => [
    {
      // Share links are public but must never be indexed. The page also carries a
      // `noindex` meta tag; this header covers the crawlers that read headers
      // first, and applies to the share asset route, which has no HTML to tag.
      source: "/s/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ],
};

export default nextConfig;
