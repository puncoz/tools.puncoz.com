import { AWS_ICONS, awsIconUrl } from "@/lib/aws-icons"
import { CLOUDFLARE_ICONS, cloudflareIconUrl } from "@/lib/cloudflare-icons"
import { getCredit, type Credit } from "@/lib/credits"

/**
 * The icon sets the draw tool can insert, as data.
 *
 * One descriptor per provider, so the picker is written once and instantiated per
 * set rather than copied. Deliberately carries no shape type: that belongs to the
 * component layer, and `lib/` must not import from `components/`. The pairing
 * happens where the pickers are mounted.
 *
 * Adding a set means a catalogue module, a build script and an entry here — see
 * `docs/adr/0003-cloudflare-icons.md`. It also means an attribution: `credit` is
 * required and is resolved from `lib/credits.ts` at module load, which throws on
 * an unknown id — so artwork cannot ship uncredited.
 */

type Icon = {
  slug: string
  name: string
}

type IconSet = {
  /** Stable key, also the React list key. */
  id: string
  /** Sits on the picker button, which is a 36px square — two or three characters. */
  label: string
  /** Accessible name and tooltip, since the label alone is an abbreviation. */
  title: string
  icons: readonly Icon[]
  urlFor: (slug: string) => string
  /** Whose artwork this is, shown in the picker and linked to `/credits`. */
  credit: Credit
}

/**
 * Every term must match, so extra words narrow rather than widen — the same rule
 * the tool directory and the drawings gallery use.
 *
 * Matches the slug as well as the name so that "ec2" finds "Amazon EC2", and
 * "kv" finds "Workers KV", even where the display name spaces or cases it
 * differently.
 */
const matchesIcon = (icon: Icon, query: string): boolean => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

  if (terms.length === 0) {
    return true
  }

  const haystack = `${icon.name} ${icon.slug}`.toLowerCase()

  return terms.every(term => haystack.includes(term))
}

/**
 * Fails at import rather than rendering a set with no attribution. The pickers
 * are client components, so a missing credit would otherwise surface as a blank
 * line in a dropdown that nobody looks at twice.
 */
const requireCredit = (id: string): Credit => {
  const credit = getCredit(id)

  if (!credit) {
    throw new Error(`Icon set "${id}" has no credit in lib/credits.ts.`)
  }

  return credit
}

const AWS_ICON_SET: IconSet = {
  id: "aws",
  label: "AWS",
  title: "AWS icons",
  icons: AWS_ICONS,
  urlFor: awsIconUrl,
  credit: requireCredit("aws-icons"),
}

const CLOUDFLARE_ICON_SET: IconSet = {
  id: "cloudflare",
  label: "CF",
  title: "Cloudflare icons",
  icons: CLOUDFLARE_ICONS,
  urlFor: cloudflareIconUrl,
  credit: requireCredit("cloudflare-icons"),
}

export { AWS_ICON_SET, CLOUDFLARE_ICON_SET, matchesIcon }
export type { Icon, IconSet }
