# 0007. Redirect `/favicon.ico` to the icon route

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The app declares its icons through Next's file conventions — `src/app/icon.png` and
`src/app/apple-icon.png` — which are linked from the document with a content hash:

```html
<link rel="icon" href="/icon.png?icon.1z-4kcf3zpf_0.png" sizes="192x192">
```

Those routes are healthy, and were measured to be so before deciding anything here:

```
/icon.png?…   cache-control: public, max-age=0, must-revalidate
              x-vercel-cache: HIT        served from the Tokyo edge, 51ms
              conditional request -> 304, 0 bytes
```

No function runs, and revalidation costs an empty 304. There is nothing to fix there —
an earlier reading that claimed otherwise had measured `/favicon.ico`, which is not
one of these routes.

`/favicon.ico` is a different matter. Nothing generates it, so it falls through to the
application's 404:

```
/favicon.ico   404, 22,266 bytes of HTML, served by a function
               cache-control: private, no-cache, no-store …
```

A full page render, in a serverless function, uncacheable, for a request that wanted a
4KB image. Browsers that parse the `<link rel="icon">` never ask for it, but the
convention long predates that tag and is still requested unprompted by crawlers, feed
readers, link unfurlers and bookmark tooling.

This is small. It is recorded because the fix is smaller.

## Decision

`next.config.ts` gains a permanent redirect from `/favicon.ico` to `/icon.png`.

Vercel resolves `redirects()` in its routing layer, so the request is answered without
invoking a function at all, and the response is a redirect rather than 22KB of HTML.

## Alternatives considered

**Commit a real `src/app/favicon.ico`.** The most direct answer, and rejected on cost:
nothing in the toolchain writes ICO. `sharp` is already a dependency and does not
encode it, so it would mean either hand-assembling the container around a PNG or
taking a dependency to produce one 4KB file — for a format whose only advantage over
the PNG already being served is the filename.

**Rewrite instead of redirect,** serving the icon bytes at `/favicon.ico` directly.
One round trip rather than two, and marginally friendlier to clients that do not
follow redirects for icons. Rejected as unverifiable from here: it depends on how
Vercel resolves a rewrite whose target is a metadata route, and this is not worth
deploying twice to find out. A redirect's behaviour is not in question.

**Leave it.** Defensible — the cost falls on bots, not on anyone waiting. Rejected
because a 22KB uncacheable function render is a silly way to say "no", and the
alternative is four lines.

## Consequences

- Bot and crawler requests for `/favicon.ico` stop invoking a function and stop
  rendering a page.
- `permanent: true` sends a 308, which clients cache indefinitely. That is the correct
  semantics — the icon does live at `/icon.png` — but it does mean that adding a real
  `favicon.ico` later would not be picked up by any client that had already followed
  this redirect. Recorded so that a future change knows to expect it.
- The healthy icon routes are untouched. They were measured, not assumed, and they are
  already cached at the edge.
- Unverified until deployed: that Vercel answers this in the routing layer without a
  function is how `redirects()` is documented to behave, not something observed on
  this project. Worth confirming against `x-vercel-id` after the next deploy.

## Follow-ups

Nothing outstanding.
