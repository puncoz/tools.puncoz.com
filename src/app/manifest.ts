import type { MetadataRoute } from "next"
import { clientConfig } from "@/config/client"

/**
 * Makes the site installable and, more usefully day to day, gives the browser a
 * real name and icon instead of a URL when it is pinned or added to a home
 * screen.
 *
 * `/icon.png` and `/apple-icon.png` are the files Next generates from
 * `src/app/icon.png` and `src/app/apple-icon.png`; referencing them here rather
 * than adding a second copy under `public/` keeps one source for the mark.
 */
const manifest = (): MetadataRoute.Manifest => ({
  name: clientConfig.app.name,
  short_name: clientConfig.app.shortName,
  description: clientConfig.app.description,
  start_url: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: clientConfig.app.brandColor,
  icons: [
    { src: "/icon.png", sizes: "192x192", type: "image/png" },
    { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
  ],
})

export default manifest
