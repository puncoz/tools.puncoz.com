import { matchesTerms } from "@/lib/icon-sets"

/**
 * Searching and ranking for the draw command palette.
 *
 * Deliberately knows nothing about tldraw, icons or React — it sorts anything
 * carrying a label and a section. The half of a command that *does* something
 * needs an `Editor` and the set-to-shape-type mapping, both of which live in
 * `components/`, and `lib/` must not import from there. So the palette's command
 * type extends `SearchableCommand` at the component layer and this module stays
 * pure.
 */

type SearchableCommand = {
  /** Unique across sections. Also the React key and the `aria-activedescendant` target. */
  id: string
  label: string
  /** Extra haystack — an icon's slug, so "kv" finds "Workers KV". */
  keywords: string
  sectionId: string
}

type SearchOptions = {
  /** Section ids in display order; ties in rank break by this. */
  sectionOrder: readonly string[]
  /** Sections shown when the query is empty. */
  defaultSections: readonly string[]
  limit?: number
}

type SearchResult<T> = {
  commands: T[]
  /** Before the limit, so the UI can say how many were hidden. */
  total: number
}

/** 404 icons will not fit on screen and nobody scrolls past the first few. */
const RESULT_LIMIT = 50

/**
 * Tier, lowest wins.
 *
 * `matchesTerms` answers yes/no, which is all a grid of results needs — a grid
 * has no first item. A keyboard list does, and with 404 icons a single character
 * matches hundreds, so "which one is highlighted when you press Enter" has to be
 * decided rather than left to catalogue order.
 *
 * Label and keywords are deliberately kept on separate tiers (2 and 3), not
 * merged into one "either matched at this level" check. `keywords` carries the
 * slug plus any AWS-style initialisms `initialismsOf` derived (see
 * `lib/icon-sets.ts`) — a *guess* at the service's abbreviation — while the
 * label is the icon's real, official name. Merging the two tiers once let a
 * derived guess out-rank a literal label word on nothing but section order:
 * "kv" matched "Kinesis Video Streams" only via its derived initialism "KVS",
 * and matched "Workers KV" via the literal word "kv" already in its label —
 * merged, both landed on the same tier and AWS's earlier section order won the
 * tie, so Kinesis beat the tool this module's own doc comment promises "kv"
 * finds. Keeping label strictly ahead of keywords means a literal match always
 * beats a derived one, never mind section order.
 *
 * `keywords` is compared token-by-token (split on whitespace), not as one
 * joined string, at both the exact-match and prefix tiers. It holds several
 * independent identifiers end to end — the slug, then each derived initialism
 * — so testing the joined string means only the *first* identifier is ever
 * reachable by `startsWith`, and none of them is ever reachable by exact
 * equality unless it happens to be the entire field. That silently stranded
 * "S3" inside "amazon-simple-storage-service sss s3": the joined string starts
 * with the slug, so `s3` could never win tier 0 or tier 3 there, and the
 * canonical service fell to the substring tier behind a variant that happened
 * to spell the query out in its own literal label instead.
 */
const rankOf = (command: SearchableCommand, query: string): number => {
  const label = command.label.toLowerCase()
  const keywordTokens = command.keywords.toLowerCase().split(/\s+/).filter(Boolean)

  if (label === query || keywordTokens.includes(query)) {
    return 0
  }

  if (label.startsWith(query)) {
    return 1
  }

  if (label.split(/\s+/).some(word => word.startsWith(query))) {
    return 2
  }

  if (keywordTokens.some(token => token.startsWith(query))) {
    return 3
  }

  return 4
}

/**
 * An empty query lists only the default sections — 31 tools and shapes (11
 * tools plus the 20 `GeoShapeGeoStyle` values), answering "what can I do".
 * Dumping every icon into an unfiltered list is noise, and they appear as
 * soon as anything is typed.
 */
const searchCommands = <T extends SearchableCommand>(
  commands: readonly T[],
  query: string,
  { sectionOrder, defaultSections, limit = RESULT_LIMIT }: SearchOptions,
): SearchResult<T> => {
  const trimmed = query.trim().toLowerCase()

  if (trimmed.length === 0) {
    const defaults = commands.filter(command => defaultSections.includes(command.sectionId))

    return { commands: defaults.slice(0, limit), total: defaults.length }
  }

  const matched = commands.filter(command =>
    matchesTerms(`${command.label} ${command.keywords}`, trimmed))

  // Section before label, so the order is stable rather than incidental — two
  // icons with the same rank should not swap places between keystrokes.
  const sorted = matched.sort((a, b) =>
    rankOf(a, trimmed) - rankOf(b, trimmed)
    || sectionOrder.indexOf(a.sectionId) - sectionOrder.indexOf(b.sectionId)
    || a.label.localeCompare(b.label))

  return { commands: sorted.slice(0, limit), total: sorted.length }
}

export { searchCommands }
export type { SearchableCommand, SearchOptions, SearchResult }
