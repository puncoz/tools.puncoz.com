# AWS icon shapes — design

Date: 2026-08-14
Status: approved

## Problem

The draw tool has tldraw's default shapes only. Drawing an AWS architecture
diagram means approximating every service with a labelled rectangle.

## Goal

Insert AWS service icons as first-class shapes — icon and caption moving and
resizing as one unit — from a searchable picker.

## Decisions

| Question | Choice |
| --- | --- |
| Shape model | Custom `aws-icon` shape: icon + built-in label |
| Icon source | `aws-icons` npm package, copied at build time |
| Picker | Search-first, flat, A–Z |

## Non-goals

- Drag-and-drop from the picker. Click-to-insert first; dragging is the obvious
  follow-up and deliberately not in v1.
- Connector anchors, auto-layout, or diagram validation.
- The `resource` (468) and `architecture-group` (15) icon sets. Services only for
  now; both are additive later since the pipeline is generic.

## Why not plain image shapes

An `image` shape pointing at a static SVG would need no schema change at all —
`TLImageAsset.src` accepts any URL, and both asset stores already pass non-
`tools-asset:` sources straight through. That was the cheaper option and it was
considered and rejected: it cannot carry a service identity or an editable caption
as one unit, which is the point of the feature.

The consequence is accepted deliberately: a custom shape type means every store
that loads a document must register the util. See [Registration](#registration).

## Icon pipeline

`aws-icons@3.3.0` — 1.2 MB, 812 SVGs, SVGO-optimised, built from the official
AWS Architecture Icons pack dated 01/30/2026. Only `icons/architecture-service`
(300 files) is used.

`scripts/build-aws-icons.ts`:

1. Reads `node_modules/aws-icons/icons/architecture-service/*.svg`.
2. Derives a slug from each filename (`AmazonAPIGateway` → `amazon-api-gateway`).
3. Copies each file to `public/aws-icons/<slug>.svg`.
4. Writes `src/lib/aws-icons/catalogue.json` — `{ slug, name }[]`, sorted by name.

It takes no network access, so builds are hermetic. `public/aws-icons/` is
gitignored and rebuilt from the dependency; the catalogue is committed, because it
is metadata rather than artwork and typecheck and lint must work without running
the script first.

Display names come from a committed slug→name map derived from the package's
upstream metadata, which carries AWS's canonical strings ("Amazon API Gateway",
not "Amazon A P I Gateway"). Slugs absent from that map — new services after a
version bump — fall back to an acronym-aware split of the filename, so a package
update surfaces new icons immediately with a reasonable name rather than dropping
them.

### Wiring, and why not `prebuild`

```json
"dev":   "bun scripts/build-aws-icons.ts && next dev --turbopack",
"build": "bun scripts/build-aws-icons.ts && next build"
```

Explicit chaining rather than npm-style `pre*` lifecycle hooks: Bun does not run
those the way npm does, and a silently skipped copy step means every icon 404s at
runtime with nothing failing at build time.

## The shape

```ts
declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    "aws-icon": { w: number; h: number; service: string; richText: TLRichText }
  }
}
```

tldraw 5 registers custom props by module augmentation rather than the generic
parameter earlier versions used.

`AwsIconShapeUtil` implements:

- `getDefaultProps` — 80×106, empty service and caption.
- `getGeometry` — a filled `Rectangle2d`, so the whole tile is clickable.
- `component` — the icon square above tldraw's `RichTextLabel`.
- `getIndicatorPath` — the tile's rectangle.
- `canEdit` — true; double-click edits the caption with tldraw's own editor.
- `toSvg` — see below.
- `static migrations` — versions 1 and 2 (see below).

### The caption is rich text, and that is not cosmetic

The caption began as a plain `label: string` rendered into an `<input>` of our
own. That was wrong twice over, and both failures came from the same mistake:

1. **It crashed the editor.** In tldraw 5, `canEdit() === true` is effectively a
   promise that the shape carries a `richText` prop. `SelectTool` honours the
   distinction — it checks `hasRichText` and falls back to a plain
   `setEditingShape` — but the geo and arrow tools' idle states call
   `startEditingShapeWithRichText` after only a `canEditShape` check, and that
   helper *throws* `Shape does not have rich text`. Selecting an icon, pressing
   `r` for the rectangle tool and pressing Enter took down the whole canvas.
2. **The custom input could never hold focus.** Entering the editing state makes
   tldraw focus its own canvas container, which blurred the input immediately.
   Three attempts to win that race — `autoFocus`, an effect, a deferred frame —
   all lost.

Using `richText` with tldraw's `RichTextLabel` resolves both: `hasRichText` is
true so no call site throws, and focus, selection, IME and mobile behaviour are
tldraw's problem rather than ours. `renderPlaintextFromRichText` flattens it for
the SVG export.

The migration sequence therefore has two entries: version 1 (the original shape)
and version 2, which converts a `label` string into `richText`. This is exactly
what having a sequence from the first release is for — it existed before it was
needed, and then it was needed.

### Export

A custom shape renders as React on the canvas, but exports go through `toSvg`.
Without it, thumbnails and PNG exports would come out with every AWS icon missing
and **nothing would raise an error** — the failure is silent, which is why it is
called out here rather than left as an implementation detail.

`toSvg` fetches the icon's SVG source, inlines it into the export, and holds the
export open with `SvgExportContext.waitUntil`. A module-level cache keyed by slug
means a diagram containing forty icons performs a handful of fetches, not forty.

## Registration

`src/components/tools/draw/shapes/index.ts` exports one `customShapeUtils` array,
imported by **both** canvases — for `createTLStore` and for the `<Tldraw>` prop:

- `draw-canvas.tsx` (owner, editable)
- `shared-canvas.tsx` (public share link, read-only)

A store's schema is built from its registered utils. If the share page ever lacks
a util the owner canvas has, a shared diagram containing AWS icons fails to load
for the visitor while working perfectly for its author — a bug that would only
show up on someone else's screen. One module, imported twice, with a comment at
each site saying they must not drift.

Adding a shape type is additive, so existing documents are unaffected.

## Picker

`src/components/tools/draw/aws-icon-picker.tsx`, opened from a button beside the
home button in tldraw's top-left zone.

A search box over an A–Z grid of all 300 services, matching the search-first
pattern already used by the tool directory and the drawings gallery: `/` focus
shortcut, `aria-live` result count, all query terms must match. Clicking an icon
inserts a shape at the centre of the current viewport with the service name as its
starting caption, and closes the panel.

Grouping by AWS category was the original intent and was dropped on evidence: the
package does not carry categories, its upstream metadata does not either, and
AWS's 26 published categories cannot be recovered from the artwork — all 300
service icons use just 7 fill colours, reused across categories (Compute,
Containers, Media Services, Blockchain and Quantum Technologies share one orange).
Reconstructing the mapping would mean hand-authoring 300 entries of invented
classification that drifts on every package update.

## Licensing

The artwork is AWS's. AWS permits customers and partners to use these icons to
create architecture diagrams, and restricts redistribution and modification. The
`aws-icons` package declares MIT, but that is the packager's declaration over
artwork it does not own — depending on it moves the question rather than settling
it.

This design keeps the artwork out of the repository: it arrives as a dependency
and is copied into a gitignored directory at build time. The site's use — drawing
architecture diagrams — is the permitted one. This is recorded so the decision is
visible rather than implicit.

## Files

New:

- `scripts/build-aws-icons.ts`
- `src/lib/aws-icons/catalogue.json` (generated, committed)
- `src/lib/aws-icons/names.json` (slug→canonical name, committed)
- `src/lib/aws-icons/index.ts` (typed catalogue access, search matcher, icon URL)
- `src/components/tools/draw/shapes/aws-icon-shape-util.tsx`
- `src/components/tools/draw/shapes/index.ts`
- `src/components/tools/draw/aws-icon-picker.tsx`

Changed:

- `package.json` — dependency and script chaining
- `.gitignore` — `public/aws-icons/`
- `src/components/tools/draw-canvas.tsx` — register utils, mount the picker
- `src/components/tools/draw/shared-canvas.tsx` — register utils
- `src/components/tools/draw/home-button.tsx` — picker trigger

## Verification

Static: typecheck, lint, build.

In the browser:

1. The picker opens, search narrows, clicking inserts a shape at the viewport
   centre with the right icon and caption.
2. The caption edits in place and survives a reload.
3. The shape moves, resizes and groups like any other.
4. **The generated thumbnail actually contains the icon** — the `toSvg` path,
   whose failure mode is silent.
5. A drawing containing AWS icons opens through a public share link while signed
   out, proving both canvases register the util.
6. A drawing created before this change still opens.
