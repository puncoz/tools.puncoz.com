# 0005. Colocate serverless functions with the database, and stop paying for the same query twice

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

The deployed site feels slow and laggy where local development does not. This is not
a bundle problem and not a rendering problem — it is geography, and it is measurable.

Measured against `https://tools.puncoz.com` on 2026-08-22:

```
/privacy   ttfb 337–651ms   (a static legal page — no database access at all)
/          ttfb 340–547ms
x-vercel-id: hnd1::iad1::…  ← request enters at Tokyo, function executes in Virginia
```

Two independent facts explain all of it:

1. **Vercel runs the functions in `iad1` (Washington DC).** There is no `vercel.json`,
   so the project sits on the default region.
2. **Supabase is in `ap-northeast-2` (Seoul).** So every single database round trip
   crosses the Pacific in both directions.

Measured RTT from a machine in Asia: Seoul `116ms`, Virginia `216ms`. The
Virginia↔Seoul leg is roughly `180–200ms` per round trip, and the transaction pooler
with `prepare: false` gives no way to amortise it — each query is its own round trip.

Locally the same queries cost ~40ms, because the dev machine and the database are
both in Asia. **That is the entire "fast locally, slow deployed" gap.** Nothing about
the code changed between the two.

Static assets are already fine and are not part of this: `/_next/static/*` returns
`public,max-age=31536000,immutable` and is served from the Tokyo edge at `51ms`
without touching a function. The cost is confined to HTML documents and API routes.

On top of the region gap, `/draw` issues **four serialised database round trips** for
one render:

| # | Where | Query |
| --- | --- | --- |
| 1 | `(tools)/layout.tsx` → `requireDbUser()` | `select users where workos_id = …` |
| 2 | `draw/page.tsx` → `requireDbUser()` | the *same* query again |
| 3 | `draw/page.tsx` | `listDrawings(user.id)` |
| 4 | `draw/page.tsx` | `countTrashedDrawings(user.id)` — awaited *after* #3 |

Query #2 is a duplicate: `toDbUser` is not wrapped in React `cache()`, so the layout
and the page each pay for it. Queries #3 and #4 are independent of each other but are
awaited sequentially. At ~200ms each that is ~800ms of pure network per page view,
before WorkOS and before the user's own 200ms hop to Virginia.

The same tax lands on every interactive action, which is what "laggy" actually
describes. `use-autosave.ts`, `use-thumbnail.ts`, `project-menu.tsx` and
`share-controls.tsx` all `fetch` an API route that authenticates (one round trip) and
then does its work (another). A single autosave `PUT` costs roughly
`200ms (browser→Virginia) + 400ms (two Virginia↔Seoul trips) + 200ms back ≈ 800ms`,
against ~50ms locally.

## Decision

Three changes, in descending order of effect. Each is independent and each is small.

1. **Pin the functions to Seoul.** Add a `vercel.json` with `"regions": ["icn1"]`,
   putting the compute in the same city as the database. Every database round trip
   drops from ~200ms to single-digit milliseconds, and an Asian user's hop to the
   function halves as a side effect.

2. **Wrap `toDbUser` in React `cache()`** in `lib/auth/current-user.ts`, so the
   layout's `requireDbUser()` and the page's resolve to one query per request. This
   is already the codebase's documented pattern for deduping between metadata and
   page (`AGENTS.md` §8); it simply was never applied to the auth lookup.

3. **Parallelise the independent queries** in `draw/page.tsx` with `Promise.all`, so
   the drawing list and the trash count share one round trip's latency rather than
   taking two.

## Alternatives considered

**Move the database to `us-east-1` instead of moving the compute.** Equivalent
latency on paper and strictly worse in practice: it is a live migration of production
data for a cosmetic gain, and it moves the data *away* from the author, who is in
Asia — every local `db:studio` session and every migration would then pay the tax
that the deployed app pays today. Moving compute is a config line; moving state is
not.

**Multi-region deployment.** Solves nothing here. The database stays in one place, so
a function in Frankfurt is further from Seoul, not closer. Read replicas would change
that calculus and are far more machinery than this problem justifies.

**Cache the pages at the CDN so the round trip stops mattering.** Does not apply to
the pages that are actually slow: `/draw` is per-user, session-gated and
`force-dynamic` by construction. It would help `/privacy` and `/`, but those are not
what the complaint is about, and the AuthKit proxy deliberately stamps `no-store` on
everything inside its matcher — `AGENTS.md` §5 and the comment in `src/proxy.ts` warn
in terms against carving routes out of that matcher to escape it. Not worth touching
for a page nobody waits on.

**Connection pooling / `prepare: true` to cut round trips.** Unavailable: Supabase's
transaction pooler does not support prepared statements, which is why `prepare: false`
is already mandatory in `src/db/index.ts`. And it would shave a fraction of a round
trip where the region change removes the whole thing.

**Leave the duplicate user lookup and only change the region.** Tempting, since after
the region move the duplicate costs ~5ms rather than ~200ms. Rejected because it is
three lines, it is the pattern this codebase already documents, and a duplicated
identity query on every authenticated render is wrong independently of what it
currently costs.

## Consequences

- The expected result is roughly `800ms → ~20ms` of database latency per `/draw`
  render, and a similar collapse on every API route the canvas calls, which is the
  interaction lag. The region change itself has **not** been measured — it cannot be
  until it is deployed, and the figure above is arithmetic, not an observation.
- The deduplication *was* measured, by counting `pg_stat_statements.calls` for the
  users-by-`workos_id` lookup across one identical navigation to `/draw?view=trash`,
  with and without the `cache()` wrapper:

  ```
  without cache():  5 lookups
  with    cache():  1 lookup
  ```

  Five rather than the two predicted from the layout/page pair: a client-side
  navigation also issues its own RSC requests, and each was repeating the identity
  query. At the ~200ms per round trip this ADR is about, that is most of a second on
  a single navigation.
- **European and North American users get slower**, and this is a real cost, accepted
  deliberately: the author and the users are in Asia, and the database is the fixed
  point everything else must sit next to.
- The region pin becomes an invariant. If the Supabase project is ever moved,
  `vercel.json` has to move with it or this regression returns silently, with no error
  and no failing check — only a feeling that the site got slow again.
- Wrapping `toDbUser` in `cache()` scopes it per request, not across requests, so it
  carries no risk of one user's row being served to another. Worth stating explicitly
  because a cache on the auth path is exactly the kind of thing a future reader should
  challenge.
- Vercel's Hobby plan allows choosing a single function region, so `["icn1"]` is
  within plan limits. A multi-region list would not be.

## Follow-ups

- The file-convention icon routes (`icon.png`, `apple-icon.png`) are served by a
  function and return `no-store`, so they are re-fetched on every page load rather
  than cached. Small, unrelated to this decision, and left alone deliberately —
  raising it rather than fixing it in passing.
- No measurement exists for how much the WorkOS session refresh in `src/proxy.ts`
  contributes, since it only fires for authenticated requests and the numbers above
  were taken signed-out. Worth measuring after this lands, when it will be a larger
  share of what remains.
- Noticed while reading, pre-existing, and deliberately **not** fixed here: on a
  brand-new account the layout and the page can both miss the lookup and both call
  `syncUser`, which selects and then inserts without an `on conflict` clause, so two
  concurrent first-sign-in renders could collide on the unique email index. The
  `cache()` added here narrows the window but does not close it, because a miss is
  cached as a miss. Untouched because it is a correctness bug in a different area
  than this decision, and it should be fixed on its own terms.
