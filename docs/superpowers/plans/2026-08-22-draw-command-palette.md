# Draw Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Press `/` on the draw canvas, search all 404 provider icons plus tldraw's tools and shapes in one list, and click to place the result exactly where it belongs.

**Architecture:** A pure search-and-rank module in `lib/` feeds a client hook that merges provider icons with tldraw's own tools and geo shapes into one uniform `Command` list. The palette renders through tldraw's `InFrontOfTheCanvas` zone and registers itself with `editor.menus` so tldraw's single-key shortcuts stand down while it is open. Choosing an icon enters a custom `StateNode` placement tool; the icon travels as the `info` argument of `setCurrentTool`, so no ambient state is needed.

**Tech Stack:** Next.js 16.2.12 (pinned), React 19, TypeScript 6 strict, Tailwind 4, tldraw 5.3.0, Bun ≥1.3.

**Spec:** [`docs/superpowers/specs/2026-08-22-draw-command-palette-design.md`](../specs/2026-08-22-draw-command-palette-design.md)
**Decision record:** [ADR 0011](../../adr/0011-command-palette-for-inserting-icons-and-shapes.md)

## Global Constraints

These come from `AGENTS.md` and apply to every task below without being repeated.

- **Never commit, never push, never `git add`.** Leave the tree dirty and summarise. This overrides the writing-plans skill's default "commit" step, which is why no task has one.
- **There is no test suite.** Verification is `bunx tsc --noEmit`, `bun run lint`, and exercising the path in a browser against `bun run dev`. Do not add a test framework.
- **`bun run build` kills a running dev server.** Do not run it casually.
- House style: double quotes, **no semicolons**, two-space indent, trailing commas in multiline, arrow functions throughout including components, `export default X` on the last line with named exports grouped at the bottom, `@/*` path alias always, imports sorted by path, inline `type` imports, `type Props = Readonly<{ … }>`.
- **Comments carry the *why*, never the *what*.** Match the surrounding density — every non-obvious decision gets the reasoning and the rejected alternative.
- `lib/` must never import from `components/`.
- Files kebab-case, components PascalCase.
- Use `bun`/`bunx`. Never `npm`, `yarn` or `pnpm`.

---

### Task 1: Shared matching and the search/rank module

Splits the one definition of "matches" out of `matchesIcon` so the palette and the existing dropdowns can never disagree, then builds ranking on top of it.

**Note on the spec:** the spec's file table named a single `lib/draw-commands.ts`. This task splits it into `lib/command-search.ts` (pure, no tldraw) because the `run` half of a command needs `Editor` and the set-to-shape-type mapping, both of which are `components/` concerns. The search half stays pure and testable in isolation. Update the spec's file table to match.

**Files:**
- Modify: `src/lib/icon-sets.ts:45-55` (extract `matchesTerms`), and add `ICON_SETS`
- Create: `src/lib/command-search.ts`

**Interfaces:**
- Consumes: `Icon`, `IconSet` from `@/lib/icon-sets`
- Produces:
  - `matchesTerms(haystack: string, query: string): boolean`
  - `ICON_SETS: readonly IconSet[]`
  - `type SearchableCommand = { id: string, label: string, keywords: string, sectionId: string }`
  - `searchCommands<T extends SearchableCommand>(commands: readonly T[], query: string, options: SearchOptions): SearchResult<T>`
  - `type SearchOptions = { sectionOrder: readonly string[], defaultSections: readonly string[], limit?: number }`
  - `type SearchResult<T> = { commands: T[], total: number }`
  - `RESULT_LIMIT: 50`

- [ ] **Step 1: Extract `matchesTerms` in `src/lib/icon-sets.ts`**

Replace the body of `matchesIcon` (currently lines 45-55) with a delegation, keeping the existing doc comment on `matchesIcon` and adding one to the new function. Behaviour must be identical — every term must match, case-insensitively, against name and slug.

```ts
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

/**
 * Matches the slug as well as the name so that "ec2" finds "Amazon EC2", and
 * "kv" finds "Workers KV", even where the display name spaces or cases it
 * differently.
 */
const matchesIcon = (icon: Icon, query: string): boolean =>
  matchesTerms(`${icon.name} ${icon.slug}`, query)
```

- [ ] **Step 2: Add `ICON_SETS` to `src/lib/icon-sets.ts`**

Place it after `CLOUDFLARE_ICON_SET`. The order is the palette's section order, so it is not incidental.

```ts
/**
 * Every set, in the order the palette lists them. The two constants above are
 * kept as named exports because `home-button.tsx` mounts one picker per set
 * explicitly; this array is for consumers that treat the sets uniformly.
 */
const ICON_SETS: readonly IconSet[] = [AWS_ICON_SET, CLOUDFLARE_ICON_SET]
```

- [ ] **Step 3: Update the export line of `src/lib/icon-sets.ts`**

Named exports stay grouped at the bottom, alphabetical:

```ts
export { AWS_ICON_SET, CLOUDFLARE_ICON_SET, ICON_SETS, matchesIcon, matchesTerms }
export type { Icon, IconSet }
```

- [ ] **Step 4: Create `src/lib/command-search.ts`**

```ts
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
 */
const rankOf = (command: SearchableCommand, query: string): number => {
  const label = command.label.toLowerCase()
  const keywords = command.keywords.toLowerCase()

  if (label === query || keywords === query) {
    return 0
  }

  if (label.startsWith(query)) {
    return 1
  }

  if (label.split(/\s+/).some(word => word.startsWith(query))) {
    return 2
  }

  if (keywords.startsWith(query)) {
    return 3
  }

  return 4
}

/**
 * An empty query lists only the default sections — around 34 tools and shapes,
 * answering "what can I do". Dumping every icon into an unfiltered list is noise,
 * and they appear as soon as anything is typed.
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

export { RESULT_LIMIT, searchCommands }
export type { SearchableCommand, SearchOptions, SearchResult }
```

- [ ] **Step 5: Verify types and lint**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: both clean. If `tsc` reports that `matchesTerms` is unused, the export line in Step 3 was missed.

- [ ] **Step 6: Check the ranking behaves, using a scratch script**

Ranking is the one piece here with behaviour worth observing rather than asserting, and it can be exercised without a browser. Write this to the scratchpad — **not** into the repo.

```bash
cat > /tmp/rank-check.ts <<'EOF'
import { searchCommands } from "@/lib/command-search"
import { ICON_SETS } from "@/lib/icon-sets"

const commands = ICON_SETS.flatMap(set =>
  set.icons.map(icon => ({
    id: `${set.id}:${icon.slug}`,
    label: icon.name,
    keywords: icon.slug,
    sectionId: set.id,
  })))

for (const query of ["ec2", "r2", "s3", "lambda", "workers kv"]) {
  const { commands: hits, total } = searchCommands(commands, query, {
    sectionOrder: ICON_SETS.map(set => set.id),
    defaultSections: [],
  })

  console.log(query.padEnd(12), String(total).padStart(4), "->", hits.slice(0, 3).map(hit => hit.label).join(" | "))
}
EOF
bun run /tmp/rank-check.ts
```

Expected: each query puts the obvious service first — `ec2` → "Amazon EC2", `r2` → an R2 entry, `s3` → "Amazon S3". Bun resolves the `@/*` alias from `tsconfig.json`. Report the actual output; if a query's first hit is not the obvious one, that is a ranking bug to fix now, not later. Delete the scratch file afterwards.

---

### Task 2: The placement tool

A tldraw `StateNode` so that Esc, right-click, a mid-placement pan, a toolbar tool switch and unmount are all handled by the state chart rather than by hand — see ADR 0011's rejected alternative.

**Files:**
- Create: `src/components/tools/draw/icon-shape-types.ts`
- Create: `src/components/tools/draw/tools/place-icon-tool.ts`
- Modify: `src/components/tools/draw-canvas.tsx` (add the `tools` prop)
- Modify: `src/components/tools/draw/home-button.tsx` (use the shared mapping)

**Interfaces:**
- Consumes: `DEFAULT_WIDTH`, `DEFAULT_HEIGHT`, `AnyIconShape` from `@/components/tools/draw/shapes/icon-shape-util`; `AWS_ICON_TYPE`, `CLOUDFLARE_ICON_TYPE` from the two shape utils
- Produces:
  - `SHAPE_TYPE_BY_SET_ID: Record<string, AnyIconShape["type"]>`
  - `PLACE_ICON_TOOL_ID = "place-icon"`
  - `type PlaceIconInfo = { shapeType: AnyIconShape["type"], slug: string, name: string }`
  - `PlaceIconTool` (default export)
  - `customTools: readonly TLStateNodeConstructor[]`

- [ ] **Step 1: Create `src/components/tools/draw/icon-shape-types.ts`**

The pairing currently sits inline in `home-button.tsx`. It moves here so the palette and the dropdowns share one mapping rather than two that can drift.

```ts
"use client"

import { AWS_ICON_TYPE } from "@/components/tools/draw/shapes/aws-icon-shape-util"
import { CLOUDFLARE_ICON_TYPE } from "@/components/tools/draw/shapes/cloudflare-icon-shape-util"
import type { AnyIconShape } from "@/components/tools/draw/shapes/icon-shape-util"

/**
 * Which shape type each icon set inserts.
 *
 * Lives here rather than in `lib/icon-sets.ts` for the reason that file already
 * records: a set descriptor is data and must not reach into `components/`. Two
 * consumers now need the pairing — the dropdowns and the command palette — so it
 * is stated once instead of being passed in from each mount site.
 *
 * Keyed by `IconSet["id"]`. A set added to `lib/icon-sets.ts` without an entry
 * here is inert in the palette rather than broken, which is the failure mode to
 * prefer: nothing throws, the icons simply do not appear.
 */
const SHAPE_TYPE_BY_SET_ID: Record<string, AnyIconShape["type"]> = {
  aws: AWS_ICON_TYPE,
  cloudflare: CLOUDFLARE_ICON_TYPE,
}

export { SHAPE_TYPE_BY_SET_ID }
```

- [ ] **Step 2: Create `src/components/tools/draw/tools/place-icon-tool.ts`**

```ts
"use client"

import { createShapeId, StateNode, type TLStateNodeConstructor, toRichText } from "tldraw"
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  type AnyIconShape,
} from "@/components/tools/draw/shapes/icon-shape-util"

/**
 * Click-to-place for provider icons.
 *
 * A tool rather than a one-shot `pointerdown` listener because placing is a
 * *mode*, and tldraw's state chart already runs modes. A hand-rolled version owns
 * every exit path itself — Escape, right-click, a pan that starts mid-placement,
 * the toolbar switching tools, the component unmounting with the listener still
 * attached — and each one missed is either a stuck crosshair or a listener that
 * fires on an unrelated click minutes later. See ADR 0011.
 *
 * The icon arrives through `setCurrentTool`'s second argument rather than through
 * a module-level store: tools are constructed once, not once per insertion, so
 * there is otherwise nowhere to put it. `onEnter` receives whatever was passed.
 */

const PLACE_ICON_TOOL_ID = "place-icon"

type PlaceIconInfo = {
  shapeType: AnyIconShape["type"]
  slug: string
  name: string
}

class PlaceIconTool extends StateNode {
  static override id = PLACE_ICON_TOOL_ID

  private pending: PlaceIconInfo | null = null

  override onEnter(info: PlaceIconInfo) {
    this.pending = info
    this.editor.setCursor({ type: "cross" })
  }

  override onExit() {
    this.pending = null
    // Restoring the cursor here rather than in `onPointerDown` covers the
    // cancelled paths too, which is the whole point of using a state node.
    this.editor.setCursor({ type: "default" })
  }

  override onPointerDown() {
    const pending = this.pending

    // Guarded on a required field rather than on the object, because
    // `setCurrentTool` defaults its `info` argument to `{}` rather than leaving
    // it undefined — so `!pending` would be false even when nothing was passed,
    // and the first click would reach `createShape({ type: undefined })` and
    // throw. Entering without a payload must return to select instead of
    // stranding the canvas in a crosshair mode with no effect.
    if (!pending?.shapeType) {
      this.editor.setCurrentTool("select")

      return
    }

    // Centred on the click rather than the viewport, which is the entire reason
    // this mode exists: in a dense diagram the viewport centre is occupied.
    const { x, y } = this.editor.inputs.currentPagePoint
    const id = createShapeId()

    this.editor.createShape<AnyIconShape>({
      id,
      type: pending.shapeType,
      x: x - DEFAULT_WIDTH / 2,
      y: y - DEFAULT_HEIGHT / 2,
      props: {
        w: DEFAULT_WIDTH,
        h: DEFAULT_HEIGHT,
        service: pending.slug,
        richText: toRichText(pending.name),
      },
    })

    this.editor.setCurrentTool("select")
    // Selected so it can be dragged or recaptioned without a second click.
    this.editor.select(id)
  }

  override onCancel() {
    this.editor.setCurrentTool("select")
  }

  override onInterrupt() {
    this.editor.setCurrentTool("select")
  }
}

/** Registered on the editable canvas only — the share view cannot insert. */
const customTools: readonly TLStateNodeConstructor[] = [PlaceIconTool]

export default PlaceIconTool
export { customTools, PLACE_ICON_TOOL_ID }
export type { PlaceIconInfo }
```

- [ ] **Step 3: Register the tool in `src/components/tools/draw-canvas.tsx`**

Add to the import block (imports sorted by path, so it goes with the other `@/components/tools/draw/*` imports):

```ts
import { customTools } from "@/components/tools/draw/tools/place-icon-tool"
```

Then add the prop to the `<Tldraw>` element at line 93:

```tsx
<Tldraw
  store={store}
  shapeUtils={customShapeUtils}
  tools={customTools}
  components={components}
  licenseKey={clientConfig.tldraw.licenseKey}
  onMount={setEditor}
/>
```

`shared-canvas.tsx` is deliberately **not** touched — a read-only viewer offering a placement mode would offer an action it cannot perform.

- [ ] **Step 4: Point `home-button.tsx` at the shared mapping**

Replace the two shape-type imports with the mapping, so there is one source for the pairing:

```ts
import { SHAPE_TYPE_BY_SET_ID } from "@/components/tools/draw/icon-shape-types"
```

and change the two picker mounts:

```tsx
<IconPicker set={AWS_ICON_SET} shapeType={SHAPE_TYPE_BY_SET_ID[AWS_ICON_SET.id]}/>

<IconPicker set={CLOUDFLARE_ICON_SET} shapeType={SHAPE_TYPE_BY_SET_ID[CLOUDFLARE_ICON_SET.id]}/>
```

Delete the now-unused `AWS_ICON_TYPE` and `CLOUDFLARE_ICON_TYPE` imports from this file.

- [ ] **Step 5: Verify types and lint**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: clean. Two likely failures, both worth understanding rather than patching around:
- `SHAPE_TYPE_BY_SET_ID[...]` is `AnyIconShape["type"] | undefined` under `noUncheckedIndexedAccess` if that flag is on. Check `tsconfig.json` before reaching for a non-null `!`, which AGENTS.md §5 forbids — widen the prop or narrow with a guard instead.
- `static override id` requires the base to declare `id`; it does (`StateNode.id`).

- [ ] **Step 6: Exercise the tool from the browser console**

Nothing calls the tool yet, so drive it directly. Start `bun run dev`, open a drawing at `/draw/<id>`, and in devtools:

```js
editor.setCurrentTool("place-icon", { shapeType: "aws-icon", slug: "ec2", name: "Amazon EC2" })
```

(If `editor` is not on `window`, add a temporary `onMount` line, or select the tool via `editor.root.children`.)

Expected, and each is a separate check — report what you actually saw:
- the cursor becomes a crosshair
- clicking the canvas creates an EC2 icon **centred on the click**, not at the viewport centre
- the new shape is selected, and the tool has returned to select
- re-entering the mode and pressing `Esc` creates nothing and restores the default cursor
- re-entering and switching to another tool from the toolbar also restores the cursor

---

### Task 3: Palette state and the `/` shortcut

The most failure-prone part of the feature. Both failure directions are silent — nothing throws, `tsc` and lint see nothing, and there is no test suite — so the guards are implemented as an explicit checklist.

**Files:**
- Create: `src/components/tools/draw/command-palette/palette-store.ts`

**Interfaces:**
- Produces:
  - `subscribePalette(listener: () => void): () => void`
  - `getPaletteSnapshot(): boolean`
  - `getServerPaletteSnapshot(): boolean`
  - `setPaletteOpen(next: boolean): void`
  - `usePaletteShortcut(editor: Editor | null): void`

- [ ] **Step 1: Create the store half of `src/components/tools/draw/command-palette/palette-store.ts`**

A module store with `useSyncExternalStore` rather than `useState`, per AGENTS.md §8 — the `/` listener lives outside React's tree and must be able to open the palette with no setter in scope.

```ts
"use client"

import { useEffect } from "react"
import type { Editor } from "tldraw"

/**
 * Open/closed state for the command palette, plus the `/` binding that opens it.
 *
 * A module store rather than component state for the same reason `lib/ui/theme.ts`
 * is one: the thing that changes the value — a `keydown` listener on `document` —
 * is outside React's tree and has no setter in scope. `useSyncExternalStore` is
 * the sanctioned way to subscribe to that.
 */

let open = false

const listeners = new Set<() => void>()

const emit = () => {
  for (const listener of listeners) {
    listener()
  }
}

const subscribePalette = (listener: () => void): (() => void) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

const getPaletteSnapshot = (): boolean => open

/** The palette is never open during a server render. */
const getServerPaletteSnapshot = (): boolean => false

const setPaletteOpen = (next: boolean): void => {
  if (open === next) {
    return
  }

  open = next
  emit()
}
```

- [ ] **Step 2: Add the guard and the listener to the same file**

Every condition below is load-bearing. Do not collapse them.

```ts
/**
 * Anything that accepts typed text. `closest` rather than a tag check so that a
 * click inside a rich-text editor's nested markup still counts as text entry —
 * tldraw's shape labels are a contenteditable, and the two picker search boxes
 * and the palette's own input are `<input>`s.
 */
const TEXT_ENTRY_SELECTOR = "input, textarea, select, [contenteditable=''], [contenteditable='true']"

const isTextEntry = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR) !== null

/**
 * Opens the palette on `/`, and only where a `/` is not text.
 *
 * Both failure directions are silent: too permissive and the palette opens while
 * you are typing a shape label, swallowing the slash; too strict and `/` does
 * nothing on the canvas. Neither throws and neither is caught by `tsc` or lint,
 * so the conditions are enumerated rather than condensed.
 *
 * Listening on `document` rather than the tldraw container is deliberate — `/`
 * has to work immediately after the route loads, while focus is still on `body`
 * and nothing has been clicked.
 */
const usePaletteShortcut = (editor: Editor | null): void => {
  useEffect(() => {
    if (!editor) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // `key` is the produced character, so layouts where `/` needs Shift work,
      // and `?` (Shift+/ on US) correctly does not match. Never test `code`.
      if (event.key !== "/") {
        return
      }

      // `cmd+/`, `ctrl+/` and `cmd+alt+/` are tldraw's own keyboard-shortcuts
      // actions. Stealing them would break the help dialog.
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      // An IME composition must not be interrupted. `229` is the legacy signal
      // for browsers where `isComposing` is unreliable — which is the only
      // reason `keyCode` appears here at all.
      if (event.isComposing || event.keyCode === 229) {
        return
      }

      if (event.defaultPrevented) {
        return
      }

      // The condition that keeps the slash typable.
      if (isTextEntry(event.target)) {
        return
      }

      // The editor's own notion of "a label is being edited". Redundant with the
      // check above in practice, kept because it is the semantic one and free.
      if (editor.getEditingShapeId() !== null) {
        return
      }

      if (getPaletteSnapshot()) {
        return
      }

      // Beyond tidiness: a bare `/` opens quick-find in Firefox.
      event.preventDefault()
      setPaletteOpen(true)
    }

    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [editor])
}

export {
  getPaletteSnapshot,
  getServerPaletteSnapshot,
  setPaletteOpen,
  subscribePalette,
  usePaletteShortcut,
}
```

- [ ] **Step 3: Verify types and lint**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: clean. `event.keyCode` is deprecated but not removed; if lint objects, keep it and disable the rule on that line with the IME reason in the comment — dropping it would break composition handling in browsers where `isComposing` lags.

---

### Task 4: Building the command list

**Files:**
- Create: `src/components/tools/draw/command-palette/use-commands.ts`

**Interfaces:**
- Consumes: `searchCommands`, `SearchableCommand` (Task 1); `SHAPE_TYPE_BY_SET_ID`, `PLACE_ICON_TOOL_ID`, `PlaceIconInfo` (Task 2)
- Produces:
  - `type Command = SearchableCommand & { toolIcon?: string, iconUrl?: string, run: (editor: Editor) => void }`
  - `type Section = { id: string, label: string }`
  - `SECTIONS: readonly Section[]`
  - `useCommands(): readonly Command[]`

- [ ] **Step 1: Create the file with the tool and geo builders**

```ts
"use client"

import { useMemo } from "react"
import { type Editor, GeoShapeGeoStyle, useTools, useTranslation } from "tldraw"
import { SHAPE_TYPE_BY_SET_ID } from "@/components/tools/draw/icon-shape-types"
import { PLACE_ICON_TOOL_ID, type PlaceIconInfo } from "@/components/tools/draw/tools/place-icon-tool"
import type { SearchableCommand } from "@/lib/command-search"
import { ICON_SETS } from "@/lib/icon-sets"

/**
 * Everything the palette can insert or activate, as one uniform list.
 *
 * Icons could be built in `lib/`, but tools cannot: they come from the
 * `useTools()` hook and their labels are translation keys needing
 * `useTranslation()`. Building all three kinds here keeps one shape of command
 * rather than two assembled in different layers.
 */

type Command = SearchableCommand & {
  /** tldraw icon name, for tool and shape rows. */
  toolIcon?: string
  /** Same-origin SVG URL, for provider icon rows. */
  iconUrl?: string
  run: (editor: Editor) => void
}

type Section = {
  id: string
  label: string
}

/**
 * `asset` and `embed` open a file picker and a URL dialog rather than inserting
 * anything, so they do not belong in an insertion palette.
 */
const EXCLUDED_TOOL_IDS = new Set(["asset", "embed"])

const SECTIONS: readonly Section[] = [
  { id: "tools", label: "Tools" },
  { id: "shapes", label: "Shapes" },
  ...ICON_SETS.map(set => ({ id: set.id, label: set.title })),
]

const SECTION_ORDER = SECTIONS.map(section => section.id)

/** An empty query answers "what can I do", not "here are 404 icons". */
const DEFAULT_SECTIONS = ["tools", "shapes"]
```

- [ ] **Step 2: Add the hook to the same file**

Note the geo handling: rectangle, ellipse and 18 others are **not** tools. They are values of `GeoShapeGeoStyle`, all driven by the single `geo` tool, which is why `useTools()` has no "rectangle" entry.

```ts
const useCommands = (): readonly Command[] => {
  const tools = useTools()
  const msg = useTranslation()

  return useMemo(() => {
    const toolCommands: Command[] = Object.values(tools)
      .filter(tool => !EXCLUDED_TOOL_IDS.has(tool.id))
      .map(tool => ({
        id: `tool:${tool.id}`,
        label: msg(tool.label),
        keywords: tool.id,
        sectionId: "tools",
        toolIcon: typeof tool.icon === "string" ? tool.icon : undefined,
        run: (editor: Editor) => editor.setCurrentTool(tool.id),
      }))

    // Derived from the enum rather than transcribed, so a value tldraw adds
    // shows up with a missing label rather than not showing up at all.
    const geoCommands: Command[] = GeoShapeGeoStyle.values.map(geo => ({
      id: `geo:${geo}`,
      label: msg(`geo-style.${geo}`),
      keywords: geo,
      sectionId: "shapes",
      toolIcon: `geo-${geo}`,
      run: (editor: Editor) => {
        editor.setStyleForNextShapes(GeoShapeGeoStyle, geo)
        editor.setCurrentTool("geo")
      },
    }))

    const iconCommands: Command[] = ICON_SETS.flatMap(set =>
      set.icons.map(icon => ({
        id: `${set.id}:${icon.slug}`,
        label: icon.name,
        keywords: icon.slug,
        sectionId: set.id,
        iconUrl: set.urlFor(icon.slug),
        run: (editor: Editor) => {
          const shapeType = SHAPE_TYPE_BY_SET_ID[set.id]

          if (!shapeType) {
            return
          }

          const info: PlaceIconInfo = { shapeType, slug: icon.slug, name: icon.name }

          editor.setCurrentTool(PLACE_ICON_TOOL_ID, info)
        },
      })))

    return [...toolCommands, ...geoCommands, ...iconCommands]
  }, [tools, msg])
}

export default useCommands
export { DEFAULT_SECTIONS, SECTION_ORDER, SECTIONS }
export type { Command, Section }
```

- [ ] **Step 3: Verify types and lint**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: clean. If `msg(\`geo-style.${geo}\`)` errors, `useTranslation()` returns `(id?: string) => string` and accepts a plain string — no cast is needed; check the import instead.

---

### Task 5: The palette dialog

**Files:**
- Create: `src/components/tools/draw/command-palette/command-palette.tsx`

**Interfaces:**
- Consumes: Tasks 1, 3 and 4
- Produces: `CommandPalette` (default export), a component taking no props

- [ ] **Step 1: Create the component shell with state and the shortcut suppression**

Typing `rect` into the palette must not fire tldraw's `e` (eraser) and `t` (text) on the way past. tldraw gates every shortcut on `areShortcutsDisabled(editor)`, which checks `editor.menus.hasAnyOpenMenus()` (`lib/ui/hooks/useKeyboardShortcuts.js:181`) — so registering as an open menu is the supported way to make it stand down, and is why this component swallows no keystrokes of its own.

```tsx
"use client"

import { Search } from "lucide-react"
import { type FunctionComponent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { TldrawUiIcon, useEditor } from "tldraw"
import { DROPDOWN_CLASSES } from "@/components/tools/draw/floating-menu"
import useCommands, {
  DEFAULT_SECTIONS,
  SECTION_ORDER,
  SECTIONS,
  type Command,
} from "@/components/tools/draw/command-palette/use-commands"
import {
  getPaletteSnapshot,
  getServerPaletteSnapshot,
  setPaletteOpen,
  subscribePalette,
  usePaletteShortcut,
} from "@/components/tools/draw/command-palette/palette-store"
import { searchCommands } from "@/lib/command-search"
import { cn } from "@/lib/utils"

const MENU_ID = "command-palette"

const CommandPalette: FunctionComponent = () => {
  const editor = useEditor()
  const open = useSyncExternalStore(subscribePalette, getPaletteSnapshot, getServerPaletteSnapshot)
  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  usePaletteShortcut(editor)

  const commands = useCommands()

  const { commands: results, total } = useMemo(
    () => searchCommands(commands, query, {
      sectionOrder: SECTION_ORDER,
      defaultSections: DEFAULT_SECTIONS,
    }),
    [commands, query],
  )

  /**
   * Registering as an open menu disables tldraw's single-key shortcuts, so
   * typing "rect" does not activate the eraser and the text tool on the way
   * past. The cleanup must also run on unmount, or the canvas is left with every
   * shortcut dead and no visible cause.
   */
  useEffect(() => {
    if (!open) {
      return
    }

    editor.menus.addOpenMenu(MENU_ID)

    return () => {
      editor.menus.removeOpenMenu(MENU_ID)
    }
  }, [editor, open])

  const close = () => {
    setPaletteOpen(false)
    setQuery("")
    setHighlighted(0)
    // Without this, Escape leaves the keyboard dead and the next tool shortcut
    // silently does nothing — which reads as the palette having broken the page.
    editor.focus()
  }

  const run = (command: Command) => {
    close()
    command.run(editor)
  }
```

- [ ] **Step 2: Add keyboard navigation and the highlight reset**

```tsx
  // A new query means the old highlight index points at a different command.
  useEffect(() => {
    setHighlighted(0)
  }, [query])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault()
      close()

      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlighted(current => Math.min(current + 1, results.length - 1))

      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlighted(current => Math.max(current - 1, 0))

      return
    }

    if (event.key === "Enter") {
      event.preventDefault()

      const command = results[highlighted]

      if (command) {
        run(command)
      }
    }
  }

  // Keeps the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [highlighted])

  if (!open) {
    return null
  }
```

- [ ] **Step 3: Add the render**

Grouped by section, matching the dropdown's visual language. `DROPDOWN_CLASSES` is reused for the surface but its absolute positioning is overridden — this is a centred dialog, not an anchored menu.

```tsx
  let index = -1

  return (
    <>
      {/* Click-away. Not `pointer-events-none` — a click outside should dismiss
          rather than reach the canvas and place something by accident. */}
      <div
        className="pointer-events-auto fixed inset-0 z-[100000] bg-black/20"
        onPointerDown={close}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Insert"
        className={cn(
          DROPDOWN_CLASSES,
          "static left-1/2 top-24 z-[100001] mx-auto mt-0 w-[32rem] max-w-[calc(100vw-2rem)] p-2",
          "fixed -translate-x-1/2",
        )}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />

          <input
            autoFocus
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search shapes, tools and icons..."
            aria-label="Search shapes, tools and icons"
            aria-activedescendant={results[highlighted] ? `command-${results[highlighted].id}` : undefined}
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <p aria-live="polite" className="sr-only">
          {total} {total === 1 ? "result" : "results"} found
        </p>

        {results.length > 0
          ? (
            <div ref={listRef} role="listbox" className="mt-2 max-h-96 overflow-y-auto">
              {SECTIONS.map(section => {
                const rows = results.filter(command => command.sectionId === section.id)

                if (rows.length === 0) {
                  return null
                }

                return (
                  <div key={section.id}>
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>

                    {rows.map(command => {
                      index += 1

                      const isHighlighted = index === highlighted

                      return (
                        <button
                          key={command.id}
                          id={`command-${command.id}`}
                          type="button"
                          role="option"
                          aria-selected={isHighlighted}
                          data-index={index}
                          onClick={() => run(command)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            isHighlighted ? "bg-accent text-foreground" : "hover:bg-accent",
                          )}
                        >
                          {command.iconUrl
                            ? (
                              // eslint-disable-next-line @next/next/no-img-element -- static
                              // same-origin SVG; the Next optimizer cannot process SVG.
                              <img src={command.iconUrl} alt="" loading="lazy" className="size-5 shrink-0"/>
                            )
                            : command.toolIcon
                              ? <TldrawUiIcon icon={command.toolIcon} label="" className="size-5 shrink-0"/>
                              : <span className="size-5 shrink-0"/>}

                          <span className="truncate">{command.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
          : (
            <p className="mt-3 px-1 pb-2 text-center text-xs text-muted-foreground">
              Nothing matches <span className="font-medium text-foreground">{query}</span>.
            </p>
          )}

        {total > results.length && (
          <p className="mt-2 border-t border-border px-1 pt-2 text-[10px] text-muted-foreground">
            Showing {results.length} of {total}. Keep typing to narrow.
          </p>
        )}
      </div>
    </>
  )
}

export default CommandPalette
```

- [ ] **Step 4: Verify types and lint**

```bash
bunx tsc --noEmit && bun run lint
```

Expected: clean. If `TldrawUiIcon`'s props reject `label=""`, check `TLUiIconProps` in `node_modules/tldraw/dist-cjs/index.d.ts` and supply what it wants — do not silence it with `any`, which AGENTS.md §5 forbids.

---

### Task 6: Mount, verify end to end, and update the docs

**Files:**
- Modify: `src/components/tools/draw-canvas.tsx:31-35` (the `components` object)
- Modify: `AGENTS.md` (§6 map and §8 patterns)
- Modify: `docs/superpowers/specs/2026-08-22-draw-command-palette-design.md` (file table, per Task 1's note)

- [ ] **Step 1: Mount the palette in `draw-canvas.tsx`**

Add the import alongside the other draw imports, then extend the module-scope `components` object. It must stay at module scope — a fresh object each render remounts every panel, as the comment at line 29 already records.

```tsx
const components: TLComponents = {
  MenuPanel: HomeButton,
  TopPanel: ProjectMenu,
  SharePanel,
  // A fixed layer with its own stacking context, so the palette sits above
  // tldraw's panels without the z-index fight `DROPDOWN_CLASSES` works around.
  InFrontOfTheCanvas: CommandPalette,
}
```

- [ ] **Step 2: Verify types and lint**

```bash
bunx tsc --noEmit && bun run lint
```

- [ ] **Step 3: Walk the `/` guard checklist in a browser**

Against `bun run dev` at `/draw/<id>`. This is where the bugs will be — **report each line with what actually happened**, not a summary.

- [ ] `/` on an empty canvas opens the palette, and no slash is typed into it
- [ ] `/` while editing a shape's text label types a slash and does **not** open the palette
- [ ] `/` inside the AWS dropdown's search box types a slash
- [ ] `/` inside the palette's own input types a slash
- [ ] `cmd+/` still opens tldraw's keyboard-shortcuts dialog
- [ ] with an IME active (macOS: add Japanese input), composing text containing `/` does not open the palette
- [ ] `Esc` closes the palette, and pressing `r` immediately after still works
- [ ] with the palette open, typing `rect` does not activate the eraser or text tool

- [ ] **Step 4: Walk the insertion checklist**

- [ ] `/`, `ec2`, `Enter` → crosshair; clicking places the icon **under the click**, not at the viewport centre
- [ ] the placed shape is selected and the tool is back to select
- [ ] `Esc` mid-placement cancels and restores the default cursor
- [ ] `/`, `rect`, `Enter` activates the `geo` tool and drags out a rectangle
- [ ] `/`, `draw`, `Enter` activates the draw tool
- [ ] an empty query lists only Tools and Shapes, not icons
- [ ] `/s/<token>` for a shared drawing has no palette and `/` does nothing there
- [ ] the AWS and CF dropdowns still work exactly as before

- [ ] **Step 5: Judge the ranking by use**

Type `ec2`, `r2`, `s3` and `rect`. Each should put the obvious thing first. If one does not, fix the tiers in `lib/command-search.ts` now — this is the check that Task 1's scratch script could only partly answer, because it did not include tools or geo shapes competing with icons.

- [ ] **Step 6: Update `AGENTS.md`**

Two edits, both in the same task as the code per AGENTS.md §3.

In the §6 repository map, add under `components/`:

```
    tools/draw/command-palette/  the "/" palette: store, commands, dialog
    tools/draw/tools/            custom tldraw StateNode tools
```

In §8, add a pattern paragraph after the "tldraw UI is injected, not wrapped" entry:

```markdown
**A canvas mode is a `StateNode`, not a listener.** Click-to-place lives in
`tools/place-icon-tool.ts` and is registered through the `Tldraw` element's
`tools` prop. The payload travels as `setCurrentTool`'s second argument and
arrives in `onEnter` — tools are constructed once, not per use, so there is
nowhere else to put it. A one-shot `pointerdown` listener is the tempting
alternative and owns every exit path itself (Escape, right-click, pan, tool
switch, unmount); each one missed is a stuck cursor or a listener that fires
minutes later. See ADR 0011.

**`/` opens the command palette, and must never eat a typed slash.** The guard in
`command-palette/palette-store.ts` is seven conditions and every one is
load-bearing — read the comments there before touching it. Both failure
directions are silent. While the palette is open it registers with
`editor.menus`, which is what makes tldraw's single-key shortcuts stand down;
that registration must be removed on unmount or the canvas is left with every
shortcut dead and no visible cause.
```

- [ ] **Step 7: Reconcile the spec's file table**

Task 1 split `lib/draw-commands.ts` into `lib/command-search.ts` plus the builders in `use-commands.ts`. Update the spec's Files table to the files that actually exist, so the spec is not left describing a design that was not built.

- [ ] **Step 8: Stop, and summarise without committing**

Leave the tree dirty. Report what was changed, what was verified in the browser, and anything that could not be checked.

---

## Self-Review

**Spec coverage:** every spec section maps to a task — the `/` guard table to Task 3, shortcut suppression to Task 5 Step 1, the command index and ranking to Tasks 1 and 4, placement to Task 2, mounting to Task 6, and the spec's verification list to Task 6 Steps 3-5.

**Placeholders:** none. Every code step carries the actual code; every verification step names the command and the expected result.

**Type consistency:** `PlaceIconInfo` is defined in Task 2 and consumed by name in Task 4. `SearchableCommand` is defined in Task 1 and extended in Task 4. `Command`, `SECTIONS`, `SECTION_ORDER` and `DEFAULT_SECTIONS` are defined in Task 4 and consumed in Task 5. `SHAPE_TYPE_BY_SET_ID` is defined in Task 2 and consumed in Tasks 2 and 4. `matchesTerms` is defined in Task 1 and consumed in Task 1 only.

**Known risk carried deliberately:** Task 2 Step 5 flags that `SHAPE_TYPE_BY_SET_ID[...]` may be `| undefined` depending on `noUncheckedIndexedAccess`. Task 4 already guards it with an early return, so the runtime behaviour is right either way; only the annotation may need adjusting.

---

## Corrections applied during execution

Deviations from the plan text above, and why. None change the shape of the
feature; all were caught either while implementing or during Task 6's review.

- **The Task 2 no-payload guard was dead as written.** The plan's `PlaceIconTool`
  typed `pending` as `PlaceIconInfo | null` and guarded with `!pending?.shapeType`
  — but `setCurrentTool`/`StateNode.transition` default a missing `info` to `{}`,
  not `undefined`, so `onEnter` always receives an object and a field-level check
  against a fully-required type can never see the empty case. Fixed inline during
  Task 2 by typing `pending` as `Partial<PlaceIconInfo> | null`, so the field
  check is meaningful rather than unreachable.
- **The geo shapes were duplicated, not derived.** Task 4's plan built a second
  `geoCommands` list from `GeoShapeGeoStyle.values` with a hand-rolled `run`,
  on the premise that `useTools()` carries no geo entries. It does
  (`useTools.js:110-122`), so every geo shape rendered twice — once from
  `toolCommands`, once from the synthesized `geoCommands`. Fixed by partitioning
  `useTools()`'s own output on `GEO_IDS.has(tool.id)` and delegating `run` to the
  tool's own `onSelect`. See the spec's corrected "Geo shapes" section.
- **Geo labels need a different translation namespace.** `msg(`tool.${geo}`)`,
  as planned, hits a hole at `tool.rhombus-2` and renders the literal key. Geo
  entries now read `msg(`geo-style.${tool.id}`)`, which is complete because it
  is driven by the same enum.
- **`removeOpenMenu` does not exist.** The plan's Task 5 code called
  `editor.menus.removeOpenMenu(MENU_ID)`. tldraw's actual method is
  `deleteOpenMenu` (`@tldraw/editor/dist-cjs/index.d.ts:1787`). Fixed in the
  implementation and in the spec.
- **`React.KeyboardEvent` doesn't resolve without a `React` import.** The plan's
  Task 5 `onKeyDown` signature used the bare `React.KeyboardEvent` global. The
  file imports named bindings from `"react"`, not the `React` namespace, so this
  was replaced with the named `KeyboardEvent` type import.
- **The dialog's class list was internally contradictory.** The plan composed
  `DROPDOWN_CLASSES` (which carries `absolute top-full`, meant for a menu
  anchored under a trigger button) with an override list that included both
  `static` and `fixed` — two positioning schemes fighting over one element,
  with the winner decided by stylesheet order rather than anything visible in
  the diff. Replaced with `MENU_SURFACE` (the surface styling only) composed
  directly with the dialog's own `fixed` placement, avoiding the conflicting pair
  entirely.
- **The highlight-reset effect tripped `react-hooks/set-state-in-effect`.** The
  plan's Task 5 Step 2 reset `highlighted` to `0` from inside a `useEffect` keyed
  on `query`. Replaced with the render-time "adjusting state when a prop
  changes" pattern React's own docs recommend: compare the current and previous
  `query` during render and call `setHighlighted` directly, rather than from an
  effect body.
- **A mutable index counter inside nested `.map()`s trips
  `react-hooks/immutability`.** The plan's Task 5 Step 3 render used `let index
  = -1` incremented inside the section/row `.map()` callbacks to compute each
  row's flat position. Replaced with `indexByCommandId`, a `Map` built once per
  `flatOrder` change, since a mutable counter captured across render closures is
  exactly what that lint rule flags.
- **`results[highlighted]` doesn't match what's on screen once results are
  grouped by section.** The plan indexed directly into `results` (sorted by
  rank) for arrow-key movement, `aria-activedescendant` and Enter, but the
  rendered list re-groups those same results by section heading — so past the
  first section, the visual order and `results`' array order diverge, and the
  "highlighted" row would stop matching what Enter actually ran. Fixed by
  introducing `flatOrder` (`SECTIONS.flatMap` filtering `results` per section,
  in display order) as the single source both the keyboard handlers and the
  render loop key off.
