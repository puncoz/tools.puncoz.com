import sharp from "sharp"

/**
 * Regenerates the derived brand files from the originals in `src/assets/img/`.
 *
 * Deliberately NOT wired into `bun run build`. Its outputs are committed, the
 * inputs change roughly never, and it leans on `sharp` — which is present only
 * as a transitive dependency of Next's image optimiser. Making a deploy depend
 * on that would be trading a stable build for a convenience nobody needs.
 *
 * Run by hand after replacing a logo:
 *
 *   bun scripts/build-brand-assets.ts
 */

const IMG = "src/assets/img"
const APP = "src/app"

/**
 * The wordmarks ship with ~250px of transparent padding baked in, which at
 * header size reads as the logo being small and sitting too high. Trimmed to
 * their ink; the originals are left untouched.
 */
const trim = async (from: string, to: string) => {
  const info = await sharp(from).trim({ threshold: 0 }).toFile(to)

  console.log(`${to}  ${info.width}x${info.height}`)
}

await trim(`${IMG}/logo.png`, `${IMG}/wordmark.png`)
await trim(`${IMG}/logo-dark.png`, `${IMG}/wordmark-dark.png`)

// `icon.png` and `apple-icon.png` are App Router conventions: Next emits the
// <link> tags for them, so there is no head markup to keep in step.
await sharp(`${IMG}/favion.png`).resize(192, 192).toFile(`${APP}/icon.png`)

// Apple wants an opaque square — a transparent icon renders black on iOS.
await sharp(`${IMG}/logo-icon-light.png`)
  .resize(180, 180, { fit: "contain", background: "#567F95" })
  .flatten({ background: "#567F95" })
  .toFile(`${APP}/apple-icon.png`)

console.log("brand assets: done")
