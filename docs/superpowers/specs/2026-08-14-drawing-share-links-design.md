# Drawing share links — design

Date: 2026-08-14
Status: approved

## Problem

A drawing can only be seen by the account that owns it. There is no way to show
one to anyone else — not a colleague, not a client, not someone without an
account.

## Goal

A per-drawing link that lets anyone who holds it view that drawing, without
signing in, and that the owner can revoke at any time.

## Decisions

| Question | Choice |
| --- | --- |
| Audience | Anyone with the link, no sign-in |
| Access level | View only |
| Freshness | Live — the link reads the current row |
| Placement | Canvas panel, gallery card menu, and a badge on shared cards |

## Non-goals

- **Editing or live collaboration.** `@tldraw/sync` needs a persistent WebSocket
  and an in-memory `TLSocketRoom`, which does not run on Vercel — established
  when snapshot autosave was chosen. Without it, two people editing means
  last-write-wins data loss, so a shared link exposes no write path at all.
- Expiry dates, password protection, view counts, per-recipient links.
- Sharing anything other than a single drawing.

## Security posture

Stated plainly because it is the feature, not a side effect: **anyone holding the
link can view that drawing without signing in, including if the link is
forwarded.** The mitigations are that sharing is per-drawing and off until
switched on, the token is infeasible to guess, and revoking takes effect on the
next request.

## Data model

Migration `0007`:

```sql
ALTER TABLE "drawings" ADD COLUMN "share_token" text;
ALTER TABLE "drawings" ADD COLUMN "shared_at" timestamptz;
CREATE UNIQUE INDEX "drawings_share_token_idx" ON "drawings" ("share_token");
```

`share_token` null means not shared. Tokens are 32 bytes from
`crypto.randomBytes`, base64url encoded — about 256 bits, so guessing is not a
threat worth engineering against.

Stored in plaintext rather than hashed, deliberately. The owner must be able to
read the link back to copy it a second time, which a hash makes impossible. The
token is a bearer credential: what it defends against is guessing, not database
disclosure. Anyone who can read the `drawings` table can already read every
document in it, so hashing the token would protect nothing that is not already
lost.

The unique index is what makes lookup by token a single indexed read, and it also
makes a collision a write error rather than a silent aliasing of two drawings.
Postgres treats nulls as distinct in a unique index, so any number of unshared
drawings coexist under it — uniqueness only binds actual tokens.

### Where the URL is built

The link is assembled in the browser from `window.location.origin`, not on the
server. The server has no reliable public origin to work from: `WORKOS_REDIRECT_URI`
is the only configured absolute URL and it belongs to the auth callback, so reusing
it would tie share links to the auth configuration and break the moment the two
differ. `share.ts` therefore exports the path (`/s/<token>`) and the client joins
it to its own origin, which is correct in development and production without a new
environment variable.

### The invariant this breaks

`queries.ts` opens with a rule: every function takes `userId` and filters on it,
because a drawing id appears in URLs and is not a secret. `getDrawingByShareToken`
is the first and only exception — a token *is* the secret, so it authenticates on
its own.

It is written as an explicit, commented exception rather than a quiet addition,
and it filters on `shareToken is not null` in addition to matching, so a null
token can never match a null column and hand out an unshared drawing.

## The public page

`/s/[token]`, a server component deliberately outside the `(tools)` route group so
it never reaches the `requireAuth()` layout guard. AuthKit's proxy still runs over
it, but with no `middlewareAuth` configured the proxy only refreshes an existing
session — a signed-out visitor passes straight through.

An unknown, revoked or malformed token renders a plain 404, indistinguishable from
a typo.

The page renders a read-only tldraw canvas: `editor.updateInstanceState({
isReadonly: true })` in `onMount`, which is tldraw's own read-only mode — pan,
zoom and copy work, editing UI is suppressed. Neither `useAutosave` nor
`useThumbnail` is mounted, and no write route accepts a share token, so read-only
is enforced by the absence of a path rather than by hiding buttons.

The page shows the drawing's title and nothing else about the owner: no email, no
account menu, no other drawings.

### Search engines

The page carries `noindex` as both a meta tag and an `X-Robots-Tag` response
header, and a new `robots.ts` disallows `/s/`. One person pasting a link somewhere
public would otherwise be enough to get a drawing into a search index, which is a
different and much worse exposure than the one the owner opted into.

## Assets

Images live in the owner's private bucket and are resolved at render time by
`/api/assets/resolve`, which requires a session and checks the key sits under
*that user's* prefix. A signed-out visitor gets a 401 and every image in a shared
drawing breaks. So sharing needs its own resolver:

```
GET /api/share/[token]/assets/resolve?key=…
```

It resolves the drawing by token and mints a signed URL from the **owner's**
storage config, behind two checks:

1. The key sits under the owner's `assets/<userId>/` prefix.
2. The key actually appears as an asset in *that drawing's* document.

The second check is what confines a token to the drawing it was issued for.
Without it, a token for one drawing could resolve an image belonging to a
different, unshared drawing of the same owner. Keys are UUIDs so guessing one is
already impractical, but "not present in this document, so no" is a guarantee and
"hard to guess" is only an obstacle.

If the owner has no object storage configured, images are inline data URLs inside
the document and resolve without this route at all.

## Owner controls

A single `share-controls.tsx`, used in both placements, so the toggle, link, copy,
regenerate and stop-sharing behaviour exist once:

- **Canvas** — a Share button in tldraw's top-right `SharePanel` zone next to the
  save status, opening a popover.
- **Gallery** — a Share entry in the card `⋯` menu that reveals the same controls
  inline, plus a badge on cards that are currently shared so a live link is
  visible at a glance.

### Tokens are not in the list payload

`listDrawings` returns `isShared` as a boolean, never the token. Tokens are live
credentials; putting every one of them into the gallery's HTML would leak them
into any screenshot or screen-share of that page. The card fetches the token from
`GET /api/drawings/[id]/share` when Share is actually opened.

## API

One route file, `api/drawings/[id]/share/route.ts`, all handlers user-scoped like
every other drawing route — a drawing belonging to someone else answers 404:

| Method | Behaviour |
| --- | --- |
| `GET` | Returns `{ shareToken, sharedAt }`, or `{ shareToken: null }` when not shared. |
| `POST` | Enables sharing, minting a token if there is none. With `{ rotate: true }` always mints a new one, invalidating the old link. |
| `DELETE` | Revokes: nulls both columns. The old link 404s from the next request. |

Plus `api/share/[token]/assets/resolve/route.ts` as described above. No other route
accepts a share token.

## Files

New:

- `drizzle/0007_add_drawing_share.sql`
- `src/lib/drawings/share.ts` — token generation and the `/s/<token>` path helper
- `src/app/api/drawings/[id]/share/route.ts`
- `src/app/api/share/[token]/assets/resolve/route.ts`
- `src/app/s/[token]/page.tsx`
- `src/app/robots.ts`
- `src/components/tools/draw/shared-canvas.tsx`
- `src/components/tools/draw/shared-asset-store.ts`
- `src/components/tools/draw/share-controls.tsx`

Changed:

- `src/db/schema/drawings.ts` — `shareToken`, `sharedAt`
- `src/lib/drawings/queries.ts` — `isShared` in the summary, `getDrawingByShareToken`,
  `enableSharing`, `rotateShareToken`, `revokeSharing`
- `src/components/tools/draw/share-panel.tsx` — mount the Share button
- `src/components/tools/draw/drawing-card.tsx` — Share entry and shared badge
- `src/app/(tools)/draw/page.tsx` — pass `isShared` through

## Verification

Static: typecheck, lint, build.

In the browser:

1. Enable sharing on a drawing; the link opens the drawing.
2. Open the same link **signed out** (private window) — it renders, and the canvas
   is genuinely read-only: no toolbar, edits impossible.
3. Revoke; the link 404s immediately.
4. Regenerate; the previous link 404s and the new one works.
5. A drawing belonging to another account answers 404 to every share method.
6. The share asset resolver rejects a key that is not present in that drawing's
   document, and rejects one under a different user's prefix.
7. The shared page exposes no owner identity and no other drawings.
