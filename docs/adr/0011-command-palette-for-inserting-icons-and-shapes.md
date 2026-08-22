# 0011. Insert icons and shapes from a keyboard-first command palette

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

There are two ways to get something onto the canvas today, and both cost a round
trip to a corner of the screen.

Provider icons come from `components/tools/draw/icon-picker.tsx`, mounted twice in
the top-left `MenuPanel` zone — once per set. Inserting one means moving the pointer
to the top-left, clicking `AWS` or `CF`, typing into that set's own search box,
clicking a result, and then dragging the shape from the viewport centre to wherever
it was actually wanted. tldraw's own shapes come from the bottom toolbar, which is a
second corner and a second interaction model.

Three specific frictions, in the order they bite:

**The set has to be chosen before the thing.** The two pickers are separate
dropdowns over separate catalogues — 299 AWS icons and 105 Cloudflare icons. Someone
who wants "R2" must first know it is Cloudflare's. The knowledge is trivial here and
will not be when a third set lands, which `lib/icon-sets.ts` is explicitly built to
allow.

**Insertion lands at the viewport centre.** `icon-picker.tsx:48` places every shape
at `editor.getViewportPageBounds().center`. That is the right default for an empty
canvas and the wrong one for a dense diagram, where the centre is exactly where the
existing work is. Every insertion is followed by a drag.

**Nothing is reachable from the keyboard.** Both pickers and the whole toolbar are
pointer targets. In a session that is otherwise keyboard-driven — tldraw binds
single keys for every tool — inserting an icon is the only step that forces a hand
off the keyboard.

`/` is unbound in this application. tldraw binds it to `open-cursor-chat`, but only
inside `if (showCollaborationUi)` (`tldraw/dist-cjs/lib/ui/context/actions.js:1742`),
and this canvas is single-player over a local `createTLStore`, so
`useShowCollaborationUi()` is false and the binding never registers.

## Decision

Add a command palette to the editable canvas, opened with `/`, that searches
provider icons and tldraw's shapes and tools in one list.

- Selecting an icon enters a **placement mode**; the next click on the canvas drops
  it there. Placement is implemented as a tldraw `StateNode` registered through the
  editor's `tools` prop, not as a one-shot pointer listener.
- The icon being placed travels as the `info` argument of
  `setCurrentTool(id, info?)` (`@tldraw/editor/dist-cjs/index.d.ts:1728`) and is
  read in the tool's `onEnter(info, from)`. No ambient state.
- Selecting a tldraw tool activates it, exactly as the toolbar button does.
- The 20 geo shapes are synthesized as palette entries from `GeoShapeGeoStyle` and
  applied as `setStyleForNextShapes` followed by `setCurrentTool("geo")`.
- The AWS and CF dropdowns stay exactly as they are.
- The palette is mounted on `/draw/[id]` only, never on the read-only `/s/[token]`.

`/` opens the palette only when the keystroke is not text. The guard is stated as an
invariant rather than an implementation detail, because its failure mode is silent:
see Consequences.

## Alternatives considered

**A one-shot pointer listener instead of a tool.** Subscribe to the next
`pointerdown` via `editor.on("event", …)`, create the shape, unsubscribe. Around
thirty lines against roughly ninety, and no change to the `Tldraw` props.

Rejected because placement is a *mode*, and tldraw's state chart already runs modes
correctly. A hand-rolled version owns every exit path itself — `Esc`, right-click, a
pan that begins mid-placement, the user switching tools from the toolbar, the
component unmounting with the listener still attached — and each one that is missed
is either a stuck crosshair cursor or a leaked listener that fires on a click made
minutes later for an unrelated reason. These surface one at a time over weeks and
each looks like an unrelated bug. This is the same reasoning that makes
`useDismissableMenu` mandatory for menus in AGENTS.md §8: the cheap version is
smaller on the day it is written and larger every month after.

**Insert at the viewport centre, matching the existing pickers.** Consistent, and
one line. Rejected because it preserves the exact friction that motivates the change
— in a dense diagram the centre is occupied, so the insertion is always followed by
a drag.

**Insert at the mouse pointer.** No extra click, and the pointer is usually already
near the gap being filled. Genuinely close, and rejected in favour of click-to-place
because the pointer's resting position at the moment `/` is pressed is incidental —
the hand has been on the keyboard — so "where the pointer happens to be" is not
reliably "where the shape belongs". The extra click buys deliberate placement.

**Replace the AWS and CF dropdowns with the palette.** Would leave one search
implementation instead of two and remove two buttons from a full-bleed canvas.
Rejected: browsing a whole set as a grid is a different task from finding a known
icon by name, and the grid is better at it. The dropdowns also carry the per-set
artwork attribution required by ADR 0004, which would need a new home.

**`Cmd+K` rather than `/`.** The conventional palette binding and unambiguous
against text entry, since a bare `/` inside a text label must remain a slash.
Rejected because `/` is free here, is one key rather than two, and was the specific
request. The text-entry ambiguity is handled by the guard rather than avoided.

**Merge the two catalogues into one dropdown.** Solves only the first of the three
frictions and none of the other two.

## Consequences

- Inserting a known icon becomes `/`, a few characters, `Enter`, click — without the
  hand leaving the keyboard until the placing click, and without knowing which
  provider owns the name.
- **Two search implementations now exist over the same catalogues.** The palette and
  `icon-picker.tsx` must agree, or the same query returns different results
  depending on the route in. Mitigated by both calling `matchesIcon` from
  `lib/icon-sets.ts`, which stays the single definition of what "matches" means. The
  palette adds ranking on top; the dropdowns do not need it, because a set browsed
  as a grid has no first result.
- **The `/` guard is load-bearing and fails silently.** If it is wrong in one
  direction the palette opens while typing a shape label and swallows the slash; if
  it is wrong in the other, `/` does nothing on the canvas. Neither throws, neither
  is caught by `tsc` or lint, and there is no test suite (AGENTS.md §10). The
  conditions are enumerated in the spec and must be treated as a checklist, not a
  sketch.
- **The geo entries are a hand-maintained projection of someone else's enum.** If
  tldraw adds a geo value, the palette silently will not offer it. Deriving the list
  from `GeoShapeGeoStyle.values` at module load rather than transcribing it keeps
  this to a missing label rather than a missing entry.
- Placement mode is a new state the canvas can be in. Anything that assumes the
  current tool is `select` after an insertion must not regress — in particular the
  autosave and thumbnail hooks, which key off the store rather than tool state and
  are therefore unaffected.
- The read-only shared canvas gains nothing and must not gain the keybinding. Its
  viewer has no insert capability, so a palette there would offer actions that
  cannot be performed.

## Follow-ups

- Recent or frequently used icons could be surfaced above the search results. Left
  out deliberately: it needs persistence and a policy for what "recent" means, and
  neither is worth deciding before the palette has been used.
- If the dropdowns go unused once the palette exists, removing them would collapse
  the two search implementations back into one. That is a separate decision and
  needs evidence from use, not prediction.
- Placement currently shows a crosshair. A live preview of the icon under the cursor
  would make the mode self-evident; it is more work and is not required for the mode
  to be usable.

## Correction (2026-08-22)

The Decision's claim that "the 20 geo shapes are synthesized as palette entries
from `GeoShapeGeoStyle` and applied as `setStyleForNextShapes` followed by
`setCurrentTool("geo")`" was based on a false reading of tldraw's `useTools()`.
That hook already spreads all 20 `GeoShapeGeoStyle` values in as their own tool
entries — `id`, translated `label`, `icon`, and a working `onSelect` that does
exactly that `setStyleForNextShapes` + `setCurrentTool` sequence
(`node_modules/tldraw/dist-cjs/lib/ui/hooks/useTools.js:110-122`). There is no
separate `"geo"` tool id to synthesize the values against.

The implementation therefore partitions `useTools()`'s own output — testing
`GeoShapeGeoStyle.values.has(tool.id)` to route each entry to the "shapes" or
"tools" section — and delegates `run` to the tool's own `onSelect`, rather than
rebuilding the mapping by hand. Building it the way this ADR originally
described would have meant a second, hand-maintained copy of tldraw's own
logic, and in practice produced every geo shape twice: once from `useTools()`,
once from the synthesized list.

The decision itself — offering geo shapes in the palette, keyed off
`GeoShapeGeoStyle` — is unchanged; only the mechanism was wrong. This is a
correction to a factual claim, not a reversal, so it is appended here rather
than filed as a superseding ADR. See the spec
(`docs/superpowers/specs/2026-08-22-draw-command-palette-design.md`) for the
corrected design detail.

This also retracts the Consequences bullet above claiming "if tldraw adds a
geo value, the palette silently will not offer it." That risk was predicated
on the rejected synthesized-list mechanism, where a new value would indeed
have needed a hand-added entry. It does not hold against the mechanism
actually shipped: `use-commands.ts` builds its tool commands from
`Object.values(useTools())` — spreading every entry the hook produces, geo
included — and partitions them into "tools" versus "shapes" with
`GEO_IDS = new Set(GeoShapeGeoStyle.values)`, the same enum tldraw itself
enumerates from. A new `GeoShapeGeoStyle` value would arrive through
`useTools()` and be routed to "shapes" automatically, with no file in this
codebase to edit. The remaining risk is narrower than the retracted bullet
implied: only a hole in tldraw's own `geo-style.<id>` translation table, not a
missing palette entry.
