# 4. Give redistributed artwork a real attribution page

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The site renders icon artwork it did not draw. AWS architecture icons and, since
[ADR 3](0003-cloudflare-icons.md), Cloudflare product icons are generated into
`public/` at build time and served to every visitor; Lucide draws the interface
icons; tldraw draws the canvas.

None of it is currently credited except one line in the footer — "Draw is built
with tldraw" — derived from a `builtWith` field that holds exactly one library per
tool and has no room for anything else.

Two of these carry obligations that the missing credit actually breaches:

- **`@cloudflare/component-icon` is BSD-3-Clause.** Redistribution in binary form
  must reproduce the copyright notice, the conditions and the disclaimer "in the
  documentation and/or other materials provided with the distribution". Rendering
  their SVGs into `public/cloudflare-icons/` and serving them is redistribution,
  so the notice has to be somewhere a person can read it.
- **AWS architecture icons are trademarked assets**, licensed for drawing
  architecture diagrams. Attribution is expected, and so is not implying that AWS
  endorses this.

There is also a structural problem specific to this site: the draw canvas is
full-bleed with no footer, and the public share view has none either. The people
most likely to want to know whose artwork they are placing — and the people
receiving a diagram made of it — never see the one line that exists today.

## Decision

**A `/credits` page** in the `(legal)` route group, beside privacy and terms,
listing every piece of artwork and the canvas library with its holder, licence,
what it is used for, and the verbatim notice where a licence demands one. Linked
from the site footer and listed in `sitemap.ts`.

**A line inside each icon picker**, naming that set's holder and linking to its
section of `/credits` by anchor. This is the creative half and it is the half that
does real work: it puts the credit in front of the person choosing the icon, on
the one screen that has no footer, at the moment it is relevant.

**One source for both.** `src/lib/credits.ts` holds the data; the page and the
picker line derive from it, and `lib/icon-sets.ts` references a credit by id. This
follows the habit the tool registry already sets — attribution is a field, not an
edit to a component.

The page states its own scope in the first paragraph: the artwork the site renders
and the library it renders on, not a full dependency licence listing.

## Alternatives considered

**Extend the footer credit line.** The obvious move, and it fails on the content:
a BSD-3 notice is a paragraph of conditions and a shouting disclaimer. That does
not belong on every page of the site, and abbreviating it to fit is precisely what
the licence does not allow.

**Turn `builtWith` into an array and render more credits inline.** Solves the
one-per-tool limit and still leaves nowhere for the notice text. It also grows a
line that sits under the landing grid on the busiest page, in exchange for
legalese nobody reads there.

**A full open-source licence page listing every dependency.** The thorough-looking
option, and dishonest by hand: a list that claims completeness while being
maintained manually is wrong the first time a dependency is added. Doing it
properly needs a generator, which is a different project. A page that states its
scope and covers it is better than a page that implies more than it delivers.

**Credit only on the page, not in the picker.** Cheaper and would satisfy the
licence. Rejected because it leaves the canvas — the only place the artwork is
actually handled — with no attribution at all, and because the picker line costs
one derived sentence.

## Consequences

Adding an icon set now means adding a credit entry: `IconSet.credit` is required
and is resolved from `lib/credits.ts` at module load, which throws on an unknown
id. That is deliberate — the attribution cannot be forgotten separately from the
artwork.

`/credits` is public and indexable, so it joins `/`, `/privacy` and `/terms` as
the fourth page in the sitemap — still an honest total.

The share view remains without visible attribution. A read-only page someone else
sent you is the wrong place for licence chrome, and the notice being reachable at
a stable URL on the same site is what the licence asks for.

The page is hand-maintained. It is small enough that this is fine, and its stated
scope is what keeps it small.
