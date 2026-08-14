import { existsSync } from "node:fs"
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import names from "../src/lib/aws-icons/names.json" with { type: "json" }

/**
 * Copies AWS service icons out of the `aws-icons` dependency into `public/`, and
 * regenerates the catalogue the picker reads.
 *
 * The artwork is AWS's. AWS permits its use for drawing architecture diagrams and
 * restricts redistribution, so it deliberately never enters this repository: it
 * arrives as a dependency and lands in a gitignored directory at build time.
 *
 * Runs with no network access, so builds stay hermetic. Chained explicitly from
 * the `dev` and `build` scripts rather than an npm-style `prebuild` hook, because
 * Bun does not run those the way npm does — and a silently skipped copy means
 * every icon 404s at runtime with nothing failing at build time.
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

const SOURCE_DIR = join(root, "node_modules", "aws-icons", "icons", "architecture-service")
const PUBLIC_DIR = join(root, "public", "aws-icons")
const CATALOGUE = join(root, "src", "lib", "aws-icons", "catalogue.json")

/** `AmazonAPIGateway` → `amazon-api-gateway`, keeping acronyms as one word. */
const toSlug = (base: string): string =>
  base
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()

/**
 * Fallback display name for a service that postdates `names.json`.
 *
 * A package bump should surface new icons immediately with a reasonable name
 * rather than dropping them; the canonical string can be backfilled later.
 */
const toDisplayName = (base: string): string =>
  base
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")

const build = async (): Promise<void> => {
  if (!existsSync(SOURCE_DIR)) {
    throw new Error(
      `Could not find ${SOURCE_DIR}. Run \`bun install\` — the aws-icons package provides it.`,
    )
  }

  const files = (await readdir(SOURCE_DIR))
    .filter(file => file.endsWith(".svg"))
    // One dark variant ships alongside its light counterpart; showing both would
    // put a confusing near-duplicate in the picker.
    .filter(file => !file.endsWith("Dark.svg"))

  // Removed rather than merged, so an icon dropped upstream disappears here too.
  await rm(PUBLIC_DIR, { recursive: true, force: true })
  await mkdir(PUBLIC_DIR, { recursive: true })

  const known = names as Record<string, string>
  const catalogue: { slug: string, name: string }[] = []
  let fallbacks = 0

  for (const file of files) {
    const base = file.replace(/\.svg$/, "")
    const slug = toSlug(base)
    const name = known[slug]

    if (!name) {
      fallbacks++
    }

    await copyFile(join(SOURCE_DIR, file), join(PUBLIC_DIR, `${slug}.svg`))
    catalogue.push({ slug, name: name ?? toDisplayName(base) })
  }

  catalogue.sort((a, b) => a.name.localeCompare(b.name))

  await writeFile(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`)

  console.log(
    `aws-icons: ${catalogue.length} icons copied`
    + (fallbacks > 0 ? `, ${fallbacks} using a derived name (missing from names.json)` : ""),
  )
}

await build()
