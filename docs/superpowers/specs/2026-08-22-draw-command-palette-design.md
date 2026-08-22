# Draw command palette — design

- **Date:** 2026-08-22
- **Decision record:** [ADR 0011](../../adr/0011-command-palette-for-inserting-icons-and-shapes.md)

## Problem

Getting anything onto the canvas costs a trip to a corner. Provider icons live in
two dropdowns in the top-left `MenuPanel`; tldraw's shapes live in the bottom
toolbar. Icons insert at the viewport centre (`icon-picker.tsx:48`), which in a
dense diagram is where the existing work already is, so every insertion is followed
by a drag. And the set has to be chosen before the icon: someone who wants "R2" must
first know it belongs to Cloudflare rather than AWS.

## Goal

`/`, a few characters, `Enter`, click. One search across all 404 icons and tldraw's
own shapes and tools, with the shape landing exactly where it is wanted, and without
the hand leaving the keyboard until the placing click.

## Decisions

1. `/` opens a palette over the editable canvas. It never opens where a `/` would
   otherwise be typed — see [The `/` guard](#the--guard), which is the most
   failure-prone part of this design.
2. Choosing an icon enters a placement mode. The next canvas click drops it there;
   `Esc` cancels.
3. Placement is a tldraw `StateNode` registered via the editor's `tools` prop. The
   icon travels as the `info` argument of `setCurrentTool(id, info?)`.
4. Choosing a tldraw tool activates it, as the toolbar button does.
5. The 20 geo shapes come from `useTools()` itself — tldraw already spreads them in
   as tools — and are partitioned out of the tool list rather than rebuilt.
6. While the palette is open, tldraw's own keyboard shortcuts are suppressed through
   `editor.menus`.
7. The AWS and CF dropdowns are untouched.

## Non-goals

- **Actions.** Undo, group, align, export and the rest are reachable by their
  existing shortcuts and menus. Adding them means deciding which are valid for the
  current selection, which is a larger problem than insertion.
- **Recents or frequency ranking.** Needs persistence and a policy; not worth
  deciding before the palette has been used.
- **The read-only shared canvas.** `/s/[token]` has no insert capability, so it gets
  neither the palette nor the keybinding.
- **Replacing the dropdowns.** Browsing a set as a grid is a different task from
  finding a known icon by name.

## The `/` guard

The requirement is that `/` opens the palette everywhere it is not text, and types a
slash everywhere it is. Both failure directions are silent — nothing throws, `tsc`
and lint see nothing, and there is no test suite (AGENTS.md §10) — so the conditions
below are a checklist to implement against, not a sketch.

A single `keydown` listener on `document`, bubble phase. It opens the palette only
when **every** one of these holds:

| # | Condition | Why |
| --- | --- | --- |
| 1 | `event.key === "/"` | `key` is the *produced character*, so layouts where `/` needs `Shift` work, and `?` (`Shift+/` on US) correctly does not match. Never test `code` or `keyCode`. |
| 2 | no `metaKey`, `ctrlKey`, `altKey` | `cmd+/` / `ctrl+/` and `cmd+alt+/` are tldraw's own keyboard-shortcuts actions. Stealing them would break the help dialog. |
| 3 | `!event.isComposing && event.keyCode !== 229` | An IME composition in flight must not be interrupted. `229` is the legacy signal for browsers where `isComposing` is unreliable, and is why `keyCode` appears here despite condition 1. |
| 4 | `!event.defaultPrevented` | Something upstream already claimed the key. |
| 5 | target is not text entry | `target.closest("input, textarea, select, [contenteditable='']," + " [contenteditable='true']")` must be `null`. This is the condition that keeps the slash typable — it covers tldraw's rich-text label editor, both picker search boxes, the palette's own input, and any future field. |
| 6 | `editor.getEditingShapeId() === null` | The editor's own notion of "a label is being edited". Redundant with 5 in practice, kept because it is the semantic check and costs nothing. |
| 7 | palette is not already open | Belt and braces with 5; makes the intent explicit. |

Only then: `event.preventDefault()`, then open. `preventDefault` matters beyond
tidiness — in Firefox a bare `/` opens quick-find.

Listening on `document` rather than on the tldraw container is deliberate: `/` must
work immediately after the route loads, before anything has been clicked and while
focus is still on `body`.

**On close**, focus returns to the canvas via `editor.focus()`. Without it, `Esc`
leaves the keyboard dead and the next tool shortcut does nothing — which reads as
the palette having broken the page.

## Suppressing tldraw's shortcuts while open

Typing `rect` into the palette must not activate the eraser (`e`) and the text tool
(`t`) on the way past.

tldraw gates every shortcut on `areShortcutsDisabled(editor)`
(`lib/ui/hooks/useKeyboardShortcuts.js:181`), which returns true when
`editor.menus.hasAnyOpenMenus()`. So the palette registers itself:
`editor.menus.addOpenMenu("command-palette")` on open, `deleteOpenMenu` on close.

This is the supported mechanism and is why the palette does not need to swallow
keystrokes itself. The `deleteOpenMenu` call must run from a cleanup path that also
fires on unmount, or the canvas is left with all shortcuts dead and no visible
cause.

(An earlier draft of this spec named this method `removeOpenMenu`. It does not
exist on tldraw's `EditorMenus` — the real name is `deleteOpenMenu`
(`@tldraw/editor/dist-cjs/index.d.ts:1787`). Corrected everywhere below.)

## The command index

A `Command` is uniform regardless of what it does:

```
type Command = {
  id: string            // "aws:ec2", "tool:draw", "tool:rectangle"
  label: string         // human text, already translated
  sectionId: SectionId  // "tools" | "shapes" | icon set id
  keywords: string      // extra haystack — the slug, so "kv" finds "Workers KV"
  run: (editor: Editor) => void
}
```

**Icons** are built in `use-commands.ts` from `ICON_SETS`, a new array in
`lib/icon-sets.ts` beside the two existing descriptors. `lib/command-search.ts`
builds nothing — it only ranks and filters the `Command`s `use-commands.ts`
assembles. Filtering reuses `matchesIcon`'s underlying `matchesTerms` from
`lib/icon-sets.ts`, so the palette and the dropdowns can never disagree about
what "matches" means.

**Tools and geo shapes** cannot be built in `lib/`: tools come from the `useTools()`
hook and their `label` is a translation key needing `useTranslation()`. They are
assembled in a client hook, `use-commands.ts`, and merged with the icon commands
there.

**Correction — geo shapes are already tools, and this design got that wrong.**
An earlier draft of this document claimed `useTools()` had no "rectangle" entry
and that the 20 geo shapes had to be synthesized from `GeoShapeGeoStyle.values`,
applying `setStyleForNextShapes` plus `setCurrentTool("geo")` by hand. That
premise is false: `useTools()` (`node_modules/tldraw/dist-cjs/lib/ui/hooks/useTools.js:110-122`)
already spreads all 20 `GeoShapeGeoStyle` values in as their own tool entries —
`id: geo`, `label: tool.${geo}`, `icon: geo-${geo}` — each with a working
`onSelect` that does exactly that `setStyleForNextShapes` + `setCurrentTool`
sequence. `useTools()` therefore returns 13 non-geo ids (`select`, `hand`,
`eraser`, `draw`, `arrow`, `line`, `frame`, `text`, `asset`, `note`, `laser`,
`embed`, `highlight`) plus the 20 geo ids — no separate `"geo"` id at all.

Building this a second time from `GeoShapeGeoStyle` — as the original draft
proposed — means owning a hand-rolled copy of tldraw's own mapping that
silently rots the moment tldraw changes it, and it also duplicates every entry
(one from the real `useTools()` list, one synthesized), which is exactly the
bug an earlier implementation attempt hit: every geo shape appeared twice in
the palette, once from each construction.

What was actually built instead: one list from `useTools()`, **partitioned**
into "shapes" and "tools" by testing `GEO_IDS.has(tool.id)` where
`GEO_IDS = new Set(GeoShapeGeoStyle.values)`, with each command's `run`
delegating to the tool's own `onSelect` rather than re-implementing it.
`asset` and `embed` are excluded from both — they open a file picker and a URL
dialog rather than inserting anything, so neither belongs in an insertion
palette.

**Label namespace is not uniform.** A geo entry's label is read from
`geo-style.<id>` (e.g. `geo-style.rectangle`), not from `tool.<id>` — tldraw's
`tool.*` translation table has a hole at `tool.rhombus-2` (every other geo id
has an entry there; that one does not), while `geo-style.*` is complete because
it is driven by the same `GeoShapeGeoStyle.values` enum that produces
`GEO_IDS`. Non-geo tools read their label from `tool.<id>` as expected.
Collapsing both onto one namespace re-opens the hole and renders the literal
string `"tool.rhombus-2"` as a label.

### Ranking

404 icons in one list means `r` matches hundreds, so filtering alone is not enough —
`matchesTerms` is a boolean and a grid of results has no first item, but a keyboard
list does. Ranking is a tier, lowest wins:

| Tier | Match |
| --- | --- |
| 0 | query equals the label, or equals a keyword token exactly |
| 1 | label starts with the query |
| 2 | a word within the label starts with the query |
| 3 | a keyword token starts with the query |
| 4 | substring anywhere — what `matchesTerms` already accepts |

`keywords` is compared token-by-token (split on whitespace) at tiers 0 and 3,
never as one joined string — see "Abbreviation keywords" below for why that
distinction is load-bearing, not cosmetic.

Ties break by section (`tools`, `shapes`, then icon sets in `ICON_SETS` order), then
alphabetically, so the order is stable rather than incidental. Label and keywords
are also strictly ordered relative to each other — tier 0/1/2 (label) always
outranks tier 3 (keywords) — so a literal word in an icon's own name always beats
a derived guess, regardless of section order.

At most 50 results render, with a count line when more matched. Grouping is by
section with a heading, matching the existing dropdown's visual language.

### Abbreviation keywords

Missing from the original design entirely. The AWS catalogue names icons by
their full service name — "Amazon Simple Storage Service" — while people type
"s3". Searching name and slug alone left `sqs`, `sns`, `ebs`, `elb` and `ses`
returning **zero** results, and `s3` finding only "AWS Outposts" (whose slug
happens to contain the substring) rather than S3 itself.

`initialismsOf` in `lib/icon-sets.ts` derives a run-length-encoded initialism
from a name — "Simple Storage Service" → first letters "SSS" → run-length
encoded "S3"; "Elastic Compute Cloud" → "ECC" → "EC2" — discarding anything
shorter than 2 characters (a one-character result has no identity and would
false-positive on every single-letter query). It feeds both `matchesIcon` (so
the existing AWS/CF dropdowns gained the same fix) and the palette's
`keywords` field, via `[icon.slug, ...initialismsOf(icon.name)].join(" ")`.

Because ranking compares keyword *tokens* rather than the joined string
(see Ranking above), each derived initialism is independently reachable by
exact match and by prefix — not just the first token in the joined string.
And because label strictly outranks keywords, a literal label match always
wins over a derived one: `kv` still finds "Workers KV" (a literal word in its
own label, tier 0/2) ahead of "Kinesis Video Streams" (matched only via its
derived initialism "KVS", tier 3) — merging the two tiers once let the latter
win purely on section order.

**With an empty query** the palette lists only tools and shapes — 31 entries (11
tools plus the 20 geo shapes), answering "what can I do". Dumping 404 icons into
an unfiltered list would be noise.

## Placement

`place-icon-tool.ts`, a `StateNode` with `static id = "place-icon"`:

- `onEnter(info)` — reads `{ shapeType, slug, name }` from the payload passed to
  `setCurrentTool`, stores it on the instance, and sets a crosshair cursor.
- `onPointerDown()` — creates the shape centred on
  `editor.inputs.currentPagePoint`, using `DEFAULT_WIDTH` / `DEFAULT_HEIGHT` and
  `toRichText(name)` exactly as `icon-picker.tsx:50` does, then returns to `select`
  with the new shape selected so it can be moved or captioned immediately.
- `onCancel` / `onInterrupt` — return to `select` without creating anything.

Entering the mode is `editor.setCurrentTool("place-icon", { shapeType, slug, name })`.
The payload arrives in `onEnter` because `setCurrentTool` forwards its second
argument (`@tldraw/editor/dist-cjs/index.d.ts:1728`) — which is why no module-level
store is needed. The tool is registered on the `Tldraw` element's `tools` prop and
**only on the editable canvas**.

The set-to-shape-type pairing (`aws` → `AWS_ICON_TYPE`) currently lives inline in
`home-button.tsx` because `lib/` must not import from `components/`. It moves to a
small `components/tools/draw/icon-shape-types.ts` so the palette and the dropdowns
share one mapping instead of two.

## Mounting

The palette renders through the `InFrontOfTheCanvas` component zone
(`@tldraw/editor/dist-cjs/index.d.ts:8394`), but that zone is only where the
`editor.menus` registration needs to live — it is not where the dialog itself
should sit. The zone renders inside `.tl-canvas__in-front`, a fixed layer that
is its own stacking context capped at `--tl-layer-canvas-in-front: 250`
(`tldraw.css:50,333`). Registering an open menu (see below) is what reactively
mounts tldraw's own `MenuClickCapture` overlay at the *same* z-index,
`--tl-layer-menu-click-capture: 250`, rendered later in tldraw's
`DefaultCanvas` — so a dialog left inside `.tl-canvas__in-front` sits below
that capture layer and is unclickable: every pointer event resolves to
`tlui-menu-click-capture` instead of the dialog. The component therefore
portals its actual dialog (and the click-away overlay) to `document.body` with
`createPortal`, escaping the zone's stacking context entirely so its
`z-[100001]` is measured against the real page and clears both
`MenuClickCapture` (250) and tldraw's `.tlui-layout` panel layer (300).

`draw-canvas.tsx`'s module-scope `components` object gains `InFrontOfTheCanvas`; a
fresh object per render would remount every panel, as the existing comment at
`draw-canvas.tsx:29` notes. `shared-canvas.tsx` is not touched.

Open/closed state is a module-level store read with `useSyncExternalStore`, per
AGENTS.md §8 — the `/` listener lives outside React's tree and must be able to open
the palette without a `useState` setter in scope.

Accessibility: `role="dialog"` with `aria-modal`, a combobox/listbox input with
`aria-activedescendant` tracking the highlighted row, and an `aria-live` count, as
`icon-picker.tsx:100` already does.

## Files

Files that actually exist, in place of the single `lib/draw-commands.ts` this
table originally named — the `run` half of a command needs an `Editor` and the
set-to-shape-type mapping, both `components/` concerns, so the search half
(`lib/command-search.ts`) stayed pure and the builders moved to `use-commands.ts`:

| File | Change |
| --- | --- |
| `src/lib/icon-sets.ts` | add `ICON_SETS`, `matchesTerms`, `initialismsOf` |
| `src/lib/command-search.ts` | new — `SearchableCommand`, `searchCommands`, ranking |
| `src/components/tools/draw/icon-shape-types.ts` | new — set id → shape type |
| `src/components/tools/draw/command-palette/command-palette.tsx` | new — the dialog |
| `src/components/tools/draw/command-palette/use-commands.ts` | new — merge tools, geo, icons into `Command`s |
| `src/components/tools/draw/command-palette/palette-store.ts` | new — open state + `/` listener |
| `src/components/tools/draw/tools/place-icon-tool.ts` | new — the `StateNode` |
| `src/components/tools/draw-canvas.tsx` | `tools` prop, `InFrontOfTheCanvas` |
| `src/components/tools/draw/home-button.tsx` | use the shared mapping |
| `AGENTS.md` | palette + placement-tool conventions |

## Verification

`bunx tsc --noEmit` and `bun run lint`, then in a browser against `bun run dev`.

The guard checklist, each confirmed by hand — this is where the bugs will be:

- `/` on an empty canvas opens the palette; no slash is typed anywhere.
- `/` while editing a shape's text label types a slash and does **not** open it.
- `/` inside the AWS dropdown's search box types a slash.
- `/` inside the palette's own input types a slash.
- `cmd+/` still opens tldraw's keyboard-shortcuts dialog.
- With an IME active, composing text containing `/` does not open the palette.
- `Esc` closes the palette, and a tool shortcut such as `r` works immediately after.
- With the palette open, typing `rect` does not activate the eraser or text tool.

Then the insertion paths: an icon places under the click and not at the viewport
centre; `Esc` mid-placement cancels cleanly and restores the normal cursor; a geo
entry activates the `geo` tool with the right shape; `/s/[token]` has no palette and
`/` does nothing there.

Ranking is judged by use rather than asserted: `ec2`, `r2`, `s3` and `rect` should
each put the obvious thing first.
