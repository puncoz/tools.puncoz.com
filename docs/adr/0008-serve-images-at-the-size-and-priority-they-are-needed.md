# 0008. Serve images at the size and priority they are actually needed

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

Vercel Speed Insights reports a Real Experience Score of 64 across the site, with
First Contentful Paint poor on **every** route at once:

| Route | RES | FCP | LCP | TTFB |
| --- | --- | --- | --- | --- |
| `/` | 69 | 4.29s | 3.98s | 1.10s |
| `/draw` | 57 | 5.61s | 6.36s | 2.79s |
| `/draw/[id]` | 63 | 4.82s | 5.01s | 0.03s |
| `/s/[token]` | 65 | 4.38s | 4.87s | 0.39s |

FCP being poor on all four simultaneously points at something in the shared shell
rather than at any one page. It is the wordmark.

`components/ui/logo.tsx` renders two `next/image`s with `priority`, from sources that
`build-brand-assets.ts` trims but never resizes. Measured in Chrome against
production on 2026-08-22, on `/draw`:

```
natural size   3840 × 1685      ← what the browser downloaded and decoded
rendered size    64 ×   28      ← what is on screen (h-7, devicePixelRatio 2)
encodedBodySize  157,942 bytes  (light)
encodedBodySize  113,976 bytes  (dark)
                 ───────────────
                 271,918 bytes  = 266KB
```

266KB of image, at 3840px wide, to paint a 64px logo — roughly **3,600× the pixel
count actually needed**. Two decoded bitmaps of 3840×1685×4 bytes is ~52MB of raw
pixels held during decode, which is main-thread work on the mid-range phones that
set a p75.

Three things make this worse than a merely oversized asset:

1. **It is preloaded at the highest priority, on every route**, because `priority`
   emits `<link rel="preload" as="image" fetchpriority="high">` into the head. It
   therefore lands in front of the CSS and JS of whichever page is loading — which is
   how a header logo becomes a whole-site FCP problem.
2. **Both variants pay it.** The dark one is `dark:hidden`, never painted in light
   mode, and downloaded anyway: `priority` defeats the lazy-loading that would
   otherwise skip a `display: none` image. This is the exact trap already documented
   in `drawing-preview.tsx`, where `loading="lazy"` was the deliberate fix — the
   logo has the same shape of bug and no such guard.
3. **Next has no way to know better.** With a static import and no `sizes`, the
   generated `srcSet` tops out at the largest device breakpoint, so `w=3840` is the
   correct behaviour given what the component tells it.

Separately, and on the same theme, the gallery's previews are all `loading="lazy"`
with `fetchPriority` unset — measured, all six on `/draw`:

```
{loading: "lazy", fetchPriority: "auto"} × 6
```

Lazy-loading defers a request until layout has run, so the above-the-fold previews —
one of which is the LCP element on `/draw` — start later than they need to. Their
first fetch is not cheap: `2084ms` for `8802` bytes, because each is an authenticated
function invocation in `icn1` that unseals a session and reads a row.

**A claim in the codebase turns out to be false and is corrected here.** Both
`api/drawings/[id]/thumbnail/route.ts` and `drawing-preview.tsx` state that AuthKit's
proxy overwrites the route's `Cache-Control` with `no-store`, so previews "cannot be
cached" and "every gallery visit refetches". Measured, that is no longer true:

```
cache-control: private, max-age=31536000, immutable   ← the route's own header, intact
```

Reading `@workos-inc/authkit-nextjs@4` confirms it. `setCachePreventionHeaders` exists
in `dist/esm/utils.js` but is **never called**; the proxy only sets `cache-control` at
`middleware-helpers.js:70`, and only when it is setting a cookie and no cache-control
is present. The blanket `private, no-cache, no-store, max-age=0, must-revalidate` seen
on HTML documents is Next's own default for a dynamic render, not AuthKit's. The
comments describe an older version's behaviour.

## Decision

Three changes, all about giving the browser accurate information about images.

1. **Resize the wordmark at generation time.** `build-brand-assets.ts` gains a
   `.resize({ width: 256 })` in `trim()`. 256px covers the 64px display box at 2×
   with headroom, and the wordmarks have exactly one consumer — `logo.tsx` — so
   nothing else can regress. The untrimmed `logo.png` / `logo-dark.png` originals,
   which the Open Graph card is built from, are untouched.

2. **Tell `next/image` the display size.** `sizes="64px"` on both wordmarks, so the
   `srcSet` is chosen against the box it is painted into rather than against the
   viewport. `priority` stays on both: which variant is needed is decided by the
   theme class before first paint, so neither can be demoted without risking a
   logo-shaped hole for half the users.

3. **Raise the priority of the first row of previews.** `DrawingPreview` takes a
   `priority` prop; `DrawingGallery` and `TrashGallery` pass it for the first three
   cards, which is one row at the widest breakpoint. Those get `fetchPriority="high"`.

   They keep `loading="lazy"`, which is the counter-intuitive half. `eager` is the
   obvious pairing and is wrong here: nothing on the server knows which of the two
   theme variants the class on `<html>` will reveal, so `eager` would have to be set
   on both, and an eager `display: none` image *is* fetched — the measurement this
   component was built around. That would double every above-the-fold request to buy
   back the little that lazy costs on a card already in the viewport. The priority
   hint reorders the queue without adding to it.

The two stale comments are corrected in the same change, and the `Cache-Control` on
the thumbnail route is promoted from aspiration to documented behaviour.

## Alternatives considered

**Redraw the wordmark as SVG.** The right long-term answer — one file, sharp at any
size, a few hundred bytes, and `currentColor` could collapse the light/dark pair into
a single element. Rejected for now because it is an asset redesign rather than a
build-script line, the source is a raster logo nobody has a vector for, and it would
hold up a fix worth 266KB on every route. Recorded as a follow-up.

**Add `sizes` and leave the 4042px source alone.** Would fix the bytes on the wire,
which is most of the win, and leaves a 4042px master in the repo that the next
component to use it inherits the same way `logo.tsx` did. The source is derived and
regenerable, so there is no reason to keep it large.

**Drop `priority` from the wordmark entirely and let it load normally.** Tempting,
since a 4KB image needs no preload. Rejected because the wordmark is above the fold
on every page and is a genuine LCP candidate on the short ones; once it is 4KB the
preload costs nothing, and removing it would trade a solved problem for a new one.

**Drop `priority` from just the dark variant.** Halves the download and breaks dark
mode's first paint: the theme class is applied by an inline script before paint, so
in dark mode it is the *dark* image that is the LCP element and the light one that is
wasted. There is no server-side way to know which, which is the whole reason both are
rendered. Once both are ~4KB the question stops mattering.

**Mark every preview eager.** Simpler, and it would put a gallery of thirty drawings
into sixty simultaneous authenticated function invocations at ~2s each — both theme
variants, since an eager hidden image is still fetched — a self-inflicted stampede.
Three is one row, and a hint rather than a mode.

**Render previews through the Next image optimiser** so they are resized and cached
at the edge. Does not work and the existing comment already says why: the optimiser
refetches server-side without the user's cookie and would only ever get a 401.

## Consequences

- The wordmark pair goes from a measured **266KB to roughly 8KB**, removed from the
  head's highest-priority preload slot on **every** route. This is the single change
  that should move FCP everywhere at once, which is the shape the numbers have.
- Decode cost falls with it: two 3840×1685 bitmaps become two 256×112 ones. On the
  low-end mobile that sets the p75 this is likely worth more than the bytes.
- `bun scripts/build-brand-assets.ts` must be run to regenerate the committed PNGs.
  The script is deliberately outside `bun run build`, so a change to it does nothing
  until someone runs it — noted because a future reader editing the resize and seeing
  no effect will otherwise lose an hour to it.
- Preview caching is now stated as fact rather than denied. Repeat gallery visits
  serve previews from the browser's disk cache; only the first visit pays the ~2s
  per-image function invocation. The `private` in that header still matters and must
  stay — these are one account's drawings and no shared cache may hold them.
- The preview change is a reordering, not an addition: the same requests are made,
  three of them sooner. It is therefore a smaller win than `eager` would have been if
  `eager` were available, and it costs nothing, which is the right trade for a card
  that is in the viewport already.
- **A trap this leaves in place:** `sizes` is the only thing standing between the
  wordmark and a 3840px download, and nothing enforces it. If the resize in the build
  script is ever reverted while `sizes` is dropped, the regression returns silently —
  no error, no failing check, just a slow site again. The 256px source is the real
  guard; `sizes` is belt and braces.

## Follow-ups

- Redraw the wordmark as SVG and collapse the two `<Image>`s into one element that
  takes its colour from the theme. Removes the duplicate download, the `sizes`
  dependency and the raster pipeline in one go.
- The first fetch of a preview costs ~2s for ~9KB, essentially all of it function
  invocation and a database read rather than bytes. Not addressed here. Making these
  edge-cacheable needs authentication that is not a session cookie — a signed,
  expiring URL — which is a bearer credential in a URL and a security decision of its
  own under `AGENTS.md` §11. Recorded, deliberately not taken.
