# Drawings gallery — design

Date: 2026-08-14
Status: approved

## Problem

The draw tool has no way to see what you have. `/draw` redirects straight to the
most recent drawing, and the only list is a text-only dropdown inside the canvas.
With more than a handful of drawings — and after the legacy import — titles alone
("Untitled", "Imported — …") do not identify anything. You have to open drawings
one at a time to find the one you want.

## Goal

A gallery at `/draw` showing every drawing as a card with a visual preview of its
contents, plus the management actions that currently only exist inside the canvas.

## Non-goals

- Folders, tags, or any grouping beyond search and sort.
- Sharing, collaboration, or public links.
- Server-side rendering of tldraw documents. Previews are captured in the browser
  that already has an editor open; the server only stores and serves bytes.
- Backfilling previews for existing drawings (see [Backfill](#backfill)).

## Routing

```
/                → tools landing
/draw            → gallery                    (was: redirect)
/draw/[id]       → canvas                     (unchanged)
```

`/draw` no longer redirects to the most recent drawing and no longer creates one
on demand. An account with no drawings sees an empty state with a **New drawing**
button.

`getMostRecentDrawing` becomes unused and is removed rather than left behind.

Navigation forms a three-level hierarchy:

- The canvas home button retargets from `/` to `/draw` ("All drawings").
- The gallery carries the "Back to tools" link to `/`.
- The canvas project menu gains an "All drawings" entry and keeps its quick
  switcher, so switching drawings without leaving the canvas still works.

Deleting from inside the canvas already pushes to `/draw`; that now lands on the
gallery instead of jumping to an arbitrary other drawing.

## Thumbnails

### Capture

A new `use-thumbnail` hook runs alongside `use-autosave` in the canvas, on its own
slower cadence so that rapid drawing produces many cheap document saves and one
expensive rasterisation.

- Debounce: 10s after the last document edit, independent of autosave's 1.5s.
- Bounds: `editor.getCurrentPageBounds()`, with a scale chosen so the longest edge
  lands near 640×480. No second canvas pass — `toImage` takes the scale directly.
- Export: `editor.toImage(shapeIds, { format: "webp", quality, background: true,
  padding, scale, darkMode: false })`. `TLExportType` includes `webp`, so no
  re-encoding step is needed; browsers that cannot encode webp via `canvas.toBlob`
  fall back to png, which the server also accepts.
- Empty page: send `thumbnail: null` so the card shows the placeholder rather than
  a stale image from before everything was deleted.
- Over the cap: retry once at a smaller scale and lower quality; if still over,
  give up silently and leave the previous thumbnail in place. A missing preview is
  never worth surfacing as an error.

The hook is deliberately **not** wired into the `pagehide` path. That path uses a
keepalive request capped at 64 KB and is reserved for the document itself.

### Storage

Migration `0006` adds two nullable columns:

```sql
ALTER TABLE "drawings" ADD COLUMN "thumbnail" text;
ALTER TABLE "drawings" ADD COLUMN "thumbnail_updated_at" timestamptz;
```

`thumbnail` holds a data URL (`data:image/webp;base64,…`), hard-capped at 400 KB
of string length. Storing it in Postgres rather than object storage is deliberate:
object storage is optional per account, and previews must work for everyone.

A new `saveThumbnail` query writes both columns and **does not touch `updatedAt`**.
A thumbnail write is not a user edit; bumping the timestamp would churn the
"recently updated" sort every time a drawing was merely opened and re-rendered.
`thumbnail_updated_at` exists precisely because of that: it is the only field that
changes when a preview changes, so it — not `updatedAt` — is what the cache buster
below has to key on.

### Serving

The list query never selects the blob. It selects `thumbnailUpdatedAt`, whose
nullness doubles as "has a thumbnail".

Inlining N data URLs into the gallery HTML would mean megabytes of markup per
render, re-sent on every navigation. Instead, cards point at:

```
GET /api/drawings/[id]/thumbnail?v={thumbnailUpdatedAt}
```

which decodes the stored data URL and returns raw image bytes with
`Cache-Control: private, max-age=31536000, immutable`. `private` because the bytes
are user data and must not be held by a shared cache.

Keying the buster on `thumbnailUpdatedAt` rather than `updatedAt` matters. The two
writes are deliberately decoupled — the document saves on a 1.5s debounce, the
preview on a 10s one — so a gallery visit made in between would cache an old image
under a URL that a later preview write would not change.

**Measured caveat.** That `Cache-Control` does not currently take effect. AuthKit's
proxy sets `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`
on every response it touches, and it wins over the route's own header. The route
cannot opt out of the proxy either — excluding it from the matcher was tried and
produces:

> You are calling 'withAuth' on a route that isn't covered by the AuthKit
> middleware.

So previews are refetched on each gallery visit rather than served from cache. At a
few kilobytes each — a single-rectangle drawing measured 1.1 KB — that is a real
but small cost, so the header and the cache key stay as they are, and caching
starts working on its own if the proxy's behaviour changes or a CDN is put in
front. Hand-rolling session decryption to escape the proxy is not worth it.

Like every other drawing route it resolves the user from the session and passes
the id to a user-scoped query, so another user's id — or a drawing with no
thumbnail — answers 404.

## API changes

| Route | Change |
| --- | --- |
| `PATCH /api/drawings/[id]` | Widens from title-only to `{ title?, thumbnail? }`. At least one field required. `thumbnail` accepts a string matching `data:image/(webp\|png);base64,` under the byte cap, or `null` to clear. A thumbnail-only patch does not bump `updatedAt`. |
| `GET /api/drawings/[id]/thumbnail` | New. Decoded image bytes, 404 when absent or not yours. Asks for `private, immutable` caching, which the AuthKit proxy currently overrides — see the caveat above. |
| `POST /api/drawings/[id]/duplicate` | New. Copies `document` and `thumbnail` into a new row titled `"<title> copy"`, returns the new drawing. |

`PUT` (document save) and `DELETE` are unchanged.

## Gallery UI

A server component fetches the summaries, formats the relative timestamps
**server-side**, and hands plain data to a client component. Formatting on the
server avoids a hydration mismatch between the server's clock at render time and
the browser's clock at hydration time; the route is already `force-dynamic`.

`drawing-gallery.tsx` (client):

- **Toolbar** — search input with a `/` focus shortcut and an `aria-live` result
  count, matching the landing page's established pattern; a sort toggle
  (Recently updated / A–Z); a **New drawing** button.
- **Grid** — 1 / 2 / 3 / 4 columns responsive.
- **Empty states** — one for "no drawings yet" (with the create button) and a
  distinct one for "no drawings match your search".

`drawing-card.tsx` (client):

- A 4:3 preview: `<img loading="lazy">` when `thumbnailUpdatedAt` is set,
  otherwise a placeholder tile showing the title's first character.
- Title and relative timestamp, with the absolute time in a `title` attribute.
- A `⋯` menu with **Rename** (inline input, existing PATCH), **Duplicate**, and
  **Delete**. Delete confirms in two steps inside the menu — never
  `window.confirm`, which blocks the page and the extension.

Filtering and sorting run client-side over the already-loaded list. For a personal
tool holding dozens of drawings that is the right trade; if the list ever grows
past a few hundred this moves to the query.

All mutations go through the existing `withProgress` / `startNavigation` helpers
so the top progress bar behaves, and finish with `router.refresh()`.

The dropdown reuses `useDismissableMenu` from `draw/floating-menu.ts`, but not
`PANEL_CLASSES` / `DROPDOWN_CLASSES` — those carry z-indexes chosen to sit above
the tldraw canvas, which does not exist on this page.

## Backfill

None. Drawings that predate this — including the imported legacy ones — have no
thumbnail and show the placeholder until opened once, at which point the hook
captures one. Nothing to run, and the gap closes on its own through normal use.

## Security

Unchanged in shape from the rest of the draw tool, and every new query follows the
same rule: it takes `userId` and filters on it. The two new routes are the only
new attack surface.

- `GET .../thumbnail` — the id is in a URL and is not a secret, so the query is
  user-scoped and a foreign id is indistinguishable from a missing one (404).
- `POST .../duplicate` — reads through a user-scoped `getDrawing` before
  inserting, so a foreign id cannot be copied into your own account.
- `PATCH` with a thumbnail — the value is validated for prefix and length before
  it reaches the database, and is only ever echoed back as image bytes with an
  explicit `Content-Type` derived from the validated prefix, never as HTML.

## Files

New:

- `drizzle/0006_add_drawing_thumbnail.sql`
- `src/lib/drawings/thumbnail.ts` — cap, data-URL validation, mime extraction
- `src/lib/ui/relative-time.ts`
- `src/app/api/drawings/[id]/thumbnail/route.ts`
- `src/app/api/drawings/[id]/duplicate/route.ts`
- `src/components/tools/draw/use-thumbnail.ts`
- `src/components/tools/draw/drawing-gallery.tsx`
- `src/components/tools/draw/drawing-card.tsx`

Changed:

- `src/db/schema/drawings.ts` — `thumbnail` and `thumbnailUpdatedAt` columns
- `src/lib/drawings/queries.ts` — `thumbnailUpdatedAt` in the summary,
  `saveThumbnail`, `duplicateDrawing`, remove `getMostRecentDrawing`
- `src/app/(tools)/draw/page.tsx` — redirect becomes the gallery
- `src/app/api/drawings/[id]/route.ts` — PATCH widened
- `src/components/tools/draw-canvas.tsx` — mount `use-thumbnail`
- `src/components/tools/draw/home-button.tsx` — retarget to `/draw`
- `src/components/tools/draw/project-menu.tsx` — "All drawings" entry

## Verification

Static: typecheck, lint, build.

In the browser:

1. Empty account → gallery empty state, **New drawing** creates and opens one.
2. Draw shapes, wait past the debounce → thumbnail PATCH fires once, not per edit.
3. Return to `/draw` → the card shows the drawing; the image request is a 200 the
   first time and served from cache on the second visit. Draw again, return, and
   confirm the preview updates — this is the case the `thumbnailUpdatedAt` buster
   exists for, and a stale image here means it is wired to the wrong field.
4. Delete every shape → the card falls back to the placeholder.
5. Search filters, sort toggles, rename / duplicate / delete each work and the
   list reflects them.
6. A thumbnail id belonging to another account answers 404.
