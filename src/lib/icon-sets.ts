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
 * Split out from `matchesIcon` so the command palette filters commands by exactly
 * the same rule the dropdowns filter icons by. Two implementations would drift,
 * and the symptom would be the same query returning different results depending
 * on which way in you took.
 */
const matchesTerms = (haystack: string, query: string): boolean => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

  if (terms.length === 0) {
    return true
  }

  const lower = haystack.toLowerCase()

  return terms.every(term => lower.includes(term))
}

/** Never the significant word AWS is naming — dropped before deriving an initialism. */
const VENDOR_WORDS = new Set(["amazon", "aws"])

/** Connective filler that carries no identity, wherever it falls in the name. */
const CONNECTIVE_WORDS = new Set(["of", "on", "for", "and", "the"])

const dropLeadingVendorWords = (words: readonly string[]): string[] => {
  const start = words.findIndex(word => !VENDOR_WORDS.has(word.toLowerCase()))

  return start === -1 ? [] : words.slice(start)
}

/**
 * A run of two or more identical letters collapses to the letter plus the count —
 * "SSS" becomes "S3". This is not a made-up compression scheme: it is how AWS
 * itself gets from "Simple Storage Service" to "S3" and from "Elastic Compute
 * Cloud" to "EC2". Reproducing the rule, rather than hand-listing the handful of
 * abbreviations we happened to think of, is what makes it apply to every icon
 * the catalogue has today and every one a future AWS asset refresh adds.
 */
const runLengthEncode = (letters: string): string => {
  let encoded = ""
  let index = 0

  while (index < letters.length) {
    let end = index

    while (end < letters.length && letters[end] === letters[index]) {
      end++
    }

    const runLength = end - index
    encoded += runLength >= 2 ? `${letters[index]}${runLength}` : letters[index]
    index = end
  }

  return encoded
}

/**
 * The initialism(s) hidden inside a spelled-out service name: "Amazon Simple
 * Storage Service" yields both "SSS" and its run-length-encoded form "S3", so a
 * search for "s3" finds an icon whose catalogue name never contains those two
 * characters together. Returned as extra keywords rather than folded into
 * `matchesIcon` directly, so the command palette (which has its own haystack,
 * not an `Icon`) can build its `keywords` field from this exact rule instead of
 * re-deriving it — a second implementation would drift the moment AWS renamed
 * one service.
 *
 * A wrong derivation costs nothing: these are appended to a haystack, never
 * substituted for it, so "Application Auto Scaling" reducing to "A2S" — a term
 * nobody types — is inert noise, not a regression. The only failure mode this
 * function can introduce is an unhelpful extra match, never a missing one — with
 * one exception large enough to guard against explicitly: a name that reduces to
 * a *single* significant word ("Amazon Redshift", "AWS Lambda") yields a
 * one-character initialism. That carries no identity — no real service is known
 * by one letter — and every one-character query would otherwise exact-match it,
 * outranking a real multi-character label like Cloudflare's "R2". So anything
 * under two characters is discarded rather than returned.
 */
const initialismsOf = (name: string): readonly string[] => {
  const words = dropLeadingVendorWords(name.split(/\s+/).filter(Boolean))
    .filter(word => !CONNECTIVE_WORDS.has(word.toLowerCase()))

  const plain = words.map(word => word[0]).join("").toUpperCase()

  if (plain.length < 2) {
    return []
  }

  const encoded = runLengthEncode(plain)

  return encoded === plain ? [plain] : [plain, encoded]
}

/**
 * Matches the slug as well as the name so that "ec2" finds "Amazon EC2", and
 * "kv" finds "Workers KV", even where the display name spaces or cases it
 * differently. Also matches the initialisms hidden in the spelled-out name, so
 * "s3", "sqs", "rds" and the rest of AWS's alphabet-soup find services whose
 * catalogue name never abbreviates them.
 */
const matchesIcon = (icon: Icon, query: string): boolean =>
  matchesTerms([icon.name, icon.slug, ...initialismsOf(icon.name)].join(" "), query)

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

/**
 * Every set, in the order the palette lists them. The two constants above are
 * kept as named exports because `home-button.tsx` mounts one picker per set
 * explicitly; this array is for consumers that treat the sets uniformly.
 */
const ICON_SETS: readonly IconSet[] = [AWS_ICON_SET, CLOUDFLARE_ICON_SET]

export { AWS_ICON_SET, CLOUDFLARE_ICON_SET, ICON_SETS, initialismsOf, matchesIcon, matchesTerms }
export type { Icon, IconSet }
