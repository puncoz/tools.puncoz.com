# 0009. Load tldraw on demand, behind a server-rendered skeleton

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The two canvas routes are the worst-scoring pages on the site:

| Route | RES | FCP | LCP |
| --- | --- | --- | --- |
| `/draw/[id]` | 63 | 4.82s | 5.01s |
| `/s/[token]` | 65 | 4.38s | 4.87s |

Both render essentially one component and nothing else. `/draw/[id]` is
`<DrawCanvas>` alone; `/s/[token]` is `<SharedCanvas>` plus a title badge. Both
components statically `import { Tldraw } from "tldraw"` and `import
"tldraw/tldraw.css"`, and there is **no `next/dynamic` anywhere in the repository**.

Two consequences, both measured against production on 2026-08-22:

**A second render-blocking stylesheet.** Next hoists an imported CSS file into a
`<link rel="stylesheet">` in the document head, so tldraw's stylesheet blocks first
paint on these routes:

```
/draw/[id] head:
  /_next/static/chunks/2lb9mw8sqs6ci.css    ← the app's own Tailwind output
  /_next/static/chunks/3x6kowiabo5v2.css    ← tldraw: 16,083 br / 77,430 raw
```

**A route bundle four times the size of any other page.**

```
/           total JS   226,680 bytes compressed
/draw/[id]  total JS   782,427 bytes compressed   (14 chunks)
```

Neither number is the real problem on its own. The problem is that **there is nothing
else on the page to paint.** FCP on these routes is not "the page appeared and the
canvas filled in afterwards" — FCP *is* tldraw finishing its download, parse,
hydration and first render, because until that happens the document is empty. The
5.01s LCP is the same event.

That the two routes differ by ~0.4s of FCP is itself the evidence: `/s/[token]`
renders one small "Read-only" badge server-side, and it is faster by roughly the cost
of having something — anything — to paint.

## Decision

Load the editor with `next/dynamic` and give each route a server-rendered skeleton to
paint immediately.

- `draw/[id]/page.tsx` and `s/[token]/page.tsx` import their canvas through
  `dynamic(() => import(...), { ssr: false, loading: () => <CanvasSkeleton/> })`.
- A new `components/tools/draw/canvas-skeleton.tsx` draws the canvas surface: the
  background, the shape of the floating panels, and the drawing's title where the
  page already knows it. It is a server component with no JavaScript of its own.
- `ssr: false` because tldraw's server render contributes nothing paintable and only
  inflates the HTML with markup that is thrown away on hydration.

The skeleton is deliberately *not* a spinner. It occupies the same regions the real
chrome will occupy, so the transition is a fill rather than a reflow.

## Alternatives considered

**`next/dynamic` with `ssr: true`.** Keeps the server render and still splits the
chunk. Rejected: tldraw needs real layout measurement and a canvas, so what it emits
server-side is a placeholder anyway. Paying to serialise and ship that placeholder,
then throwing it away, is strictly worse than rendering our own placeholder that we
control the look of.

**Leave the JS alone and only extract the CSS.** The stylesheet is 16KB compressed and
render-blocking, so hoisting it out of the head is the cheaper half of the win. But
FCP on these routes is gated on tldraw *rendering*, not on the stylesheet arriving —
removing the block without giving the page something to draw would move FCP by very
little. The two halves only pay off together.

**Preload the tldraw chunk from the gallery**, so opening a drawing finds it warm.
Attractive and complementary rather than alternative: it does nothing for a cold
visit, a direct link or a share link, which is where the p75 comes from. Worth doing
later; recorded as a follow-up.

**Split tldraw itself into a lighter core.** Not ours to do, and the icon shape utils
in `shapes/` are already the only part we control.

**A spinner instead of a skeleton.** Cheaper to write and it makes FCP look identical
in the numbers while making the page feel worse: a spinner tells the reader to wait,
a skeleton tells them what is coming. Since the whole point is that a real paint
happens early, it should be a paint worth having.

## Consequences

- FCP on both canvas routes should move from "after ~780KB of JS has parsed and
  hydrated" to "as soon as the HTML is parsed" — a change of kind rather than degree,
  because today the number is gated on an event that has nothing to do with paint.
- LCP will follow only if the skeleton's largest element is comparable to the
  canvas's. It is the full-bleed surface, so it should be.
- **A visible skeleton is a new thing on screen.** On a fast connection there will be
  a brief flash of skeleton where previously there was a blank page. That is a real
  cost and it is accepted: a blank page for 4.8s scores worse and reads worse than a
  skeleton for 200ms.
- The skeleton and the real chrome must be kept in visual step. If a panel moves in
  `floating-menu.ts` and not in the skeleton, the fill becomes a jump. Noted because
  nothing enforces it and no test will catch it.
- `ssr: false` means these routes now ship *less* HTML, which slightly reduces TTFB
  as a side effect of not serialising a discarded tree.
- Anything that assumed the canvas exists at first render must not regress. The
  autosave, thumbnail and theme hooks all already key off `onMount` or the store
  rather than mount timing, so they are unaffected — but that is now load-bearing
  rather than incidental.

## Follow-ups

- Prefetch the canvas chunk on hover or pointerdown over a gallery card, so the
  common path — gallery, then open a drawing — finds tldraw already cached. Does
  nothing for cold or shared visits, which is why it is not the fix here.
- Nothing yet measures how much of the remaining time is tldraw's own hydration
  versus the network. Worth knowing before deciding whether the skeleton is the end
  of this or the first step.
