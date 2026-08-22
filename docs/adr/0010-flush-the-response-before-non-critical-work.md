# 0010. Flush the response before work the reader is not waiting for

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

`/draw` has the worst Time to First Byte on the site at **2.79s** (p75, Vercel Speed
Insights), against 1.10s for `/`.

It is not the queries. Checked while investigating: `drawings_user_updated_idx`
covers the gallery's `where user_id = … and deleted_at is null order by updated_at
desc`, the partial `drawings_user_deleted_idx` covers the trash count, `workos_id`
carries a unique constraint and therefore an index, and `listDrawings` already selects
summary columns only, deliberately omitting `document` and both thumbnail columns. The
work per query is small and [ADR 0005](0005-colocate-functions-with-the-database.md)
already moved the functions next to the database and collapsed the duplicate identity
lookup.

What is left is **serialisation**. Nothing is sent to the browser until every one of
these has finished:

```
proxy: AuthKit session refresh
  └─ requireDbUser()          — identity lookup            (round trip 1)
      └─ Promise.all([listDrawings, countTrashedDrawings]) (round trip 2)
          └─ render, then flush
```

The second wave genuinely depends on the first — `userId` comes out of it — so it
cannot be parallelised further. But the reader is waiting on all of it for a page
whose header, heading and breadcrumbs are known before any of it starts.

`/draw/[id]` has a smaller version of the same problem. `touchDrawing` writes
`lastOpenedAt` and is `await`ed before the page returns:

```ts
await touchDrawing(user.id, drawing.id)
return <DrawCanvas … />
```

Nobody is waiting for that write. It is bookkeeping, its result is not rendered, and
it delays the response by a full round trip.

(`/draw/[id]`'s reported TTFB of 0.03s should be ignored, and is worth stating so it
is not mistaken for a success. That route authenticates, reads a row and writes one
before responding; 30ms is not physically achievable from a browser. It is a
soft-navigation artifact from the gallery. The page is not fast.)

## Decision

Stop blocking the response on work that is not needed to start painting.

1. **Stream `/draw`.** The page renders its shell — `PageShell`, the heading, the
   tabs — synchronously, and moves the two data-dependent regions behind
   `<Suspense>`. The document flushes as soon as the shell is rendered; the gallery
   streams in when the queries resolve. `requireDbUser()` stays outside the boundary,
   because an unapproved user must redirect rather than be shown a shell they are
   about to be sent away from.

2. **Defer `touchDrawing` with `after()`.** `import { after } from "next/server"`, and
   schedule the write to run once the response has been sent. Next 16 guarantees the
   callback runs after the response completes, which is exactly the semantics this
   needs and is why it is not simply a floating promise.

Both are local changes. Neither touches the auth choke point, the query layer or any
security invariant.

## Alternatives considered

**Fold the trash count into `listDrawings` as a window function**, saving nothing —
they are already in the same `Promise.all` and share one round trip's latency. It
would save a connection, not a wave.

**Key the drawing queries off `workos_id` with a join, so they can be issued in the
same wave as the identity lookup.** This is the only change that would genuinely
remove a round trip. Rejected firmly: every function in `lib/*/queries.ts` takes the
local `userId` first and filters on it, and that uniformity is the reason the
user-scoping invariant is checkable by reading. Threading an identity-provider id
into the data layer to save one round trip would trade a security property that holds
by construction for a latency win that streaming gets anyway.

**Cache the gallery.** It is per-user, session-gated and `force-dynamic` by
construction. The same argument ADR 0005 made against CDN-caching `/draw` still holds.

**Fire `touchDrawing` without awaiting it.** Works locally and is unreliable in
serverless: the function can be frozen or reclaimed the moment the response is sent,
so a floating promise is a write that usually lands. `after()` exists precisely
because that pattern is wrong, and Next will warn about the floating promise besides.

**Drop `touchDrawing` entirely.** `lastOpenedAt` is written and, as far as this change
is concerned, not read by anything on a hot path — so deleting it is tempting. Out of
scope: removing a column's only writer is a product decision, not a performance one,
and `after()` makes it free either way.

**Leave `/draw` alone and accept the TTFB.** The 2.79s is the worst number on the
site and the gallery is the entry point to the only working tool. Not a candidate.

## Consequences

- `/draw`'s TTFB should drop to roughly the cost of rendering the shell, with the
  gallery arriving as a second chunk. The *total* time to a complete gallery is
  unchanged — this moves when the first byte lands, not when the data does. That is
  the honest framing: it is a real improvement to FCP and to perceived speed, and it
  is not a database optimisation.
- The gallery needs a fallback, and a fallback that shifts layout when it is replaced
  would trade TTFB for CLS. It renders skeleton cards at the same dimensions as real
  ones.
- Streaming and `force-dynamic` coexist without ceremony, but the response is now
  chunked. Anything that assumed a single complete HTML document — a naive scraper, a
  test that reads `response.text()` once — sees a different shape.
- `after()` makes the write invisible to the reader, including its failures. A failed
  `lastOpenedAt` update will now be silent where it previously would have surfaced as
  a failed render. That is the right trade for bookkeeping and the wrong one for
  anything that matters, so `after()` must not spread to writes whose success the
  user depends on.
- **`requireDbUser()` stays outside the Suspense boundary on purpose.** Moving it
  inside would flush a shell to a user who is about to be redirected to `/account`,
  turning a clean redirect into a flash of a page they may not use. A future change
  that streams "more" of this page must not move it.

## Follow-ups

- The AuthKit session refresh in the proxy runs before any of this and is still
  unmeasured — the same gap [ADR 0005](0005-colocate-functions-with-the-database.md)
  recorded and did not close. Now that the application-side serialisation is gone, it
  is a larger share of what remains, and it is the next thing to measure.
- `lastOpenedAt` has a writer and no reader on any path touched here. Worth
  confirming it earns its keep before it is carried forward indefinitely.
