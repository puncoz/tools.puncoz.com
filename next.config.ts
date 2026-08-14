import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
