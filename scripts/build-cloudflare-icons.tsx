import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { ComponentType, SVGProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import products from "../src/lib/cloudflare-icons/products.json" with { type: "json" }

/**
 * Renders Cloudflare product icons out of `@cloudflare/component-icon` into
 * `public/`, and regenerates the catalogue the picker reads.
 *
 * Unlike its AWS counterpart this cannot copy files: the package ships React
 * components, not SVGs, so each one is rendered to static markup here. The
 * components are deep-imported from `es/reactsvgs/` rather than through the
 * package root, which matters twice over — the root pulls in Cloudflare's style
 * packages and declares a React ^15–17 peer range against this project's React
 * 19, while the leaf modules import nothing but `react` and render cleanly.
 *
 * Runs with no network access, so builds stay hermetic. Chained explicitly from
 * the `dev` and `build` scripts rather than an npm-style `prebuild` hook, because
 * Bun does not run those the way npm does — and a silently skipped render means
 * every icon 404s at runtime with nothing failing at build time.
 *
 * See `docs/adr/0003-cloudflare-icons.md` for why the set is an allowlist and why
 * the colour is baked in here rather than applied at render time.
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const PUBLIC_DIR = join(root, "public", "cloudflare-icons")
const CATALOGUE = join(root, "src", "lib", "cloudflare-icons", "catalogue.json")

/**
 * Cloudflare orange, baked into the markup at build time.
 *
 * The upstream art is monochrome — one path, no `fill` declared — so a colour has
 * to come from somewhere or the icons render black and vanish on a dark canvas.
 * Setting it here rather than on the shape keeps the served SVG self-contained,
 * so it is correct in an `<img>`, in an export, and in a thumbnail alike.
 */
const BRAND = "#F6821F"

/**
 * Puts the fill on an inner `<g>` rather than on the root `<svg>`.
 *
 * It looks like the long way round and it is the only way that survives export.
 * `icon-shape-util.tsx` inlines icons into exported SVG by stripping the outer
 * `<svg>` wrapper and re-emitting the contents inside one of its own — so a fill
 * living on the root is discarded, and paths that declare none of their own come
 * out black. Caught by regenerating a thumbnail and finding zero orange pixels in
 * it while the AWS icons beside it were intact; the AWS artwork colours its own
 * elements, so it never depended on the wrapper.
 */
const withBrandFill = (markup: string): string => {
  const openTag = /^<svg[^>]*>/.exec(markup)?.[0]
  const close = markup.lastIndexOf("</svg>")

  if (!openTag || close === -1) {
    throw new Error(`Rendered markup is not a single <svg> element: ${markup.slice(0, 80)}`)
  }

  const inner = markup.slice(openTag.length, close)

  return `${openTag}<g fill="${BRAND}">${inner}</g></svg>`
}

/**
 * `WorkersKv` → `workers-kv`, keeping acronyms as one word. Matches the AWS slugs.
 *
 * `Outline`, `Solid` and `Logo` are stripped first. They describe the drawing
 * style inside Cloudflare's own design system and mean nothing here — the
 * allowlist never takes two variants of the same icon, so the distinction carries
 * no information and would otherwise leave `magic-transit-logo` in a public URL.
 *
 * These slugs are written into every saved shape, so they are permanent: changing
 * one later orphans the icon in every drawing that used it. Hence the collision
 * check at the call site rather than trusting that stripping stays unambiguous.
 */
const toSlug = (name: string): string =>
  name
    .replace(/(Outline|Solid|Logo)$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

/**
 * Fails loudly on an export that has disappeared upstream.
 *
 * The allowlist is written by hand against a package that is a general UI kit and
 * renames things for reasons unrelated to this project, so a bump silently
 * dropping an icon is the realistic failure. Better to stop the build than to
 * ship a picker that quietly lost Workers KV.
 */
const loadIcon = async (exportName: string): Promise<IconComponent> => {
  try {
    const loaded = await import(
      `@cloudflare/component-icon/es/reactsvgs/${exportName}.js`
    ) as { default: IconComponent }

    return loaded.default
  } catch {
    throw new Error(
      `@cloudflare/component-icon no longer exports "${exportName}". `
      + "Update src/lib/cloudflare-icons/products.json — it was renamed or removed upstream.",
    )
  }
}

const build = async (): Promise<void> => {
  const catalogue: { slug: string, name: string }[] = []

  // Removed rather than merged, so an icon dropped from the allowlist disappears
  // from `public/` too instead of lingering as an orphan.
  await rm(PUBLIC_DIR, { recursive: true, force: true })
  await mkdir(PUBLIC_DIR, { recursive: true })

  const claimed = new Map<string, string>()

  for (const [exportName, name] of Object.entries(products as Record<string, string>)) {
    const Icon = await loadIcon(exportName)
    const slug = toSlug(exportName)

    // Two exports collapsing to one slug would have the second silently overwrite
    // the first — one icon in `public/`, two catalogue entries pointing at it.
    // Stripping the style suffixes makes that reachable: allowlisting both `R2`
    // and `R2Outline` would do it.
    const previous = claimed.get(slug)

    if (previous) {
      throw new Error(
        `"${exportName}" and "${previous}" both slug to "${slug}". `
        + "Drop one from src/lib/cloudflare-icons/products.json.",
      )
    }

    claimed.set(slug, exportName)

    const markup = withBrandFill(renderToStaticMarkup(<Icon/>))

    await writeFile(join(PUBLIC_DIR, `${slug}.svg`), `${markup}\n`)
    catalogue.push({ slug, name })
  }

  catalogue.sort((a, b) => a.name.localeCompare(b.name))

  await writeFile(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`)

  console.log(`cloudflare-icons: ${catalogue.length} icons rendered`)
}

await build()
