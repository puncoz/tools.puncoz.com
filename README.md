# Dev Tools (tools.puncoz.com)

A personal collection of small web tools behind a single sign-in.

| Tool | Route | Status |
| --- | --- | --- |
| **Draw** — infinite tldraw canvas for diagrams and sketches, with AWS and Cloudflare icons | `/draw` | live |
| **Editor** — Notion-style rich text notes | `/notes` | soon |

Tools are declared in [`src/lib/tools.ts`](src/lib/tools.ts). The landing page
derives its grid, search index and category filters from that list, so adding a
tool needs no UI changes.

## Stack

- **Next.js 16** (App Router, Turbopack) and **React 19**
- **WorkOS AuthKit** for authentication — one sign-in covers every tool
- **Supabase Postgres** via **Drizzle ORM** over `postgres.js`
- **tldraw 5** for the draw tool
- **Tailwind CSS 4**
- **Bun** for installs and scripts

## Getting started

Requires [Bun](https://bun.sh), a WorkOS application, and a Supabase project.

```bash
bun install
cp .env.example .env    # then fill it in — see below
bun run db:migrate      # apply migrations to your database
bun run dev             # http://localhost:3000
```

### Environment

[`.env.example`](.env.example) documents every variable and where to find it.
Three are easy to get wrong:

- **`CREDENTIALS_ENCRYPTION_KEY`** encrypts users' object-storage credentials
  before they reach the database. Keep it stable and use the *same* value in
  production — changing it makes every stored credential undecryptable, and they
  have to be re-entered.
- **`DATABASE_URL`** is Supabase's *transaction pooler* (port 6543), used at
  runtime. Transaction mode cannot use prepared statements, which is why the
  client in `src/db/index.ts` is created with `prepare: false`.
- **`DIRECT_URL`** is the *session pooler* (port 5432), used only by drizzle-kit
  for migrations. Supabase's "Direct connection" host is IPv6-only without the
  paid add-on, so it fails on most home and CI networks; the session pooler is
  IPv4 on every tier.

`NEXT_PUBLIC_TLDRAW_LICENSE_KEY` is optional — without it tldraw works and only
logs a warning about production use. It is `NEXT_PUBLIC_` by necessity: tldraw
validates the licence in the browser, so the key ships in the client bundle. It
is a licence assertion rather than a credential, and is meant to be readable
there.

Missing variables are caught at boot by `src/instrumentation.ts` rather than at
the first call site, so the app fails fast with a list of what is absent. The
licence key is deliberately *not* in that required list.

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Build the icon sets, then start the dev server |
| `bun run build` | Build the icon sets, then build for production |
| `bun run lint` | ESLint |
| `bun run db:generate` | Generate a migration from schema changes |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:studio` | Drizzle Studio |
| `bun run icons:build` | Regenerate `public/aws-icons/` and `public/cloudflare-icons/` |

## Notable design decisions

Details and rationale live in [`docs/superpowers/specs/`](docs/superpowers/specs).
The short version:

**Every drawing query is user-scoped.** Functions in `src/lib/drawings/queries.ts`
take a `userId` and filter on it, because a drawing id travels in URLs and is not
a secret. A drawing belonging to someone else answers 404, identically to one
that does not exist. There is exactly one deliberate exception,
`getDrawingByShareToken`, and it is commented as such — a share token *is* the
secret, so it authenticates on its own.

**Environment variables are read in one place.** `src/config/` wraps them in
lazily-evaluated getters; nothing else touches `process.env`. Eager reads break
`next build`.

**The functions are pinned to Seoul, next to the database.** Supabase is in
`ap-northeast-2`; Vercel's default region is `iad1` in Virginia, which sent every
query on a ~200ms round trip across the Pacific — while local development, sharing a
continent with the database, stayed fast and hid the cost entirely. `vercel.json`
pins the compute to `icn1`. This deliberately trades latency for European and North
American visitors, who are not the audience, in exchange for the database being close
to both the app and its author. If the database ever moves, that pin moves with it —
nothing breaks if it does not, the site merely gets slow again.
[ADR 0005](docs/adr/0005-colocate-functions-with-the-database.md) has the numbers.

**`src/proxy.ts`, not the repo root.** Next 16 replaces `middleware.ts` with
`proxy.ts`, and in a `src/` project it must live in `src/` or it is silently
ignored. Every authenticated route must stay inside its matcher: `withAuth`
throws outright on a path the AuthKit proxy does not cover.

**Drawings persist as tldraw snapshots.** `@tldraw/sync` needs a persistent
WebSocket and does not run on Vercel, so the canvas autosaves a document snapshot
on a debounce instead. Gallery previews are rendered in the browser and stored as
a size-capped WebP — twice, once per theme, since tldraw's exporter takes a
`darkMode` flag and a light preview on a dark card looks broken. The card renders
both and hides one with `dark:`; a `loading="lazy"` image that is `display: none`
is never fetched, so a gallery still downloads one image per card. Drawings whose
preview predates the dark column fall back to the light bytes until they are next
opened.

**Object storage is optional and per-account.** Users can point the draw tool at
their own S3, Cloudflare R2 or Supabase Storage bucket under
`/settings/storage`. Uploads go browser-to-bucket through presigned URLs, which
keeps images clear of Vercel's 4.5 MB request cap. Without a bucket configured,
images embed as data URLs and a document size guard warns before saving breaks.

**Share links are opt-in and revocable.** `/s/<token>` renders a drawing
read-only to anyone holding the link, without a sign-in. Sharing is off per
drawing until switched on, and revoking takes effect on the next request.

**Deleting a drawing is soft.** It moves to `/draw?view=trash` with its
document, preview and share token intact, and the link goes dead until it is
restored. Nothing removes a row except an explicit "delete forever" or "empty
trash" — those two are the only destructive paths, and both refuse to touch a
drawing that is not already in the trash.

**The palette is two blues, not one.** `--brand` is the logo colour `#567F95`
exactly, used where nothing is written on top of it — rings, hover borders, icon
tiles, links, active tabs. White text on it measures 4.32:1, short of WCAG AA for
body-size text, so filled buttons use `--primary`, the same hue darkened to
5.8:1. They read as one colour; only the contrast differs.

**Dark mode is class-based, not `prefers-color-scheme`.** A media query cannot be
overridden, and the header offers light/dark/**system**. An inline script in
`src/app/layout.tsx` puts the class on `<html>` before first paint — hence
`suppressHydrationWarning` — and `use-canvas-theme.ts` mirrors it into tldraw,
which keeps its own theme and would otherwise stay white inside a dark shell.

**Brand assets are derived, and the script is manual.**
`scripts/build-brand-assets.ts` crops the wordmarks to their ink and writes the
favicons and the site's share image. Its outputs are committed and it is
deliberately not part of `bun run build` — the inputs change roughly never, so
running it on every deploy would be work in exchange for nothing.

**A shared drawing unfurls as itself.** `/s/[token]/opengraph-image.tsx` composes
the drawing's preview onto the brand colour at 1200×630, so a pasted link shows
the drawing rather than a bare URL. It reuses `getDrawingByShareToken`'s exact
WHERE clause, so a revoked, trashed or banned-owner drawing falls back to an
anonymous card — and so does a malformed token, because an unfurl must not become
a way to test whether a token was ever real. The page stays `noindex`: this makes
links previewable in chat clients, not findable in search.

`sharp` is a direct dependency for that one route. Previews are stored as WebP —
a fifth the size of PNG, which matters on a route the AuthKit proxy makes
uncacheable — and Satori, behind `next/og`, cannot decode WebP. So the card
transcodes once per unfurl. It is pinned to `next`'s own range, since `next`
already depends on it; a newer major would put a second copy in the bundle.

**Analytics is opt-in, and absent when unconfigured.** Vercel Analytics and
Speed Insights are cookieless and always on. Google Analytics runs only when
`NEXT_PUBLIC_GA_MEASUREMENT_ID` is set — without it there is no script and no
cookie banner at all, so local development and forks never touch the property.
When it is set, an inline script establishes Consent Mode v2 defaults *before*
gtag loads (advertising signals hardcoded denied, analytics denied unless
previously accepted), and the banner's Accept fires a `consent update`. A
returning visitor who already agreed gets `granted` as the default rather than a
denied-then-granted flip, so the first pageview is not counted twice. The privacy
policy describes exactly this — **if you change the consent behaviour, change the
policy with it.**

**Only four pages are indexable.** `sitemap.ts` lists `/`, `/privacy`, `/terms`
and `/credits`; everything else needs a session or is disallowed in `robots.ts`.
Listing a route a crawler gets redirected away from is worse than omitting it.

**Attribution is derived and enforced.** `/credits` names the artwork the site
renders — AWS and Cloudflare icons, Lucide, tldraw — with the terms each is used
under, and reproduces the notices two of those licences require. It is generated
from `src/lib/credits.ts`, which `lib/icon-sets.ts` also reads: an icon set
without a matching credit throws at module load, so artwork cannot ship
uncredited. Each icon picker carries a one-line credit linking to its section,
because the canvas and the share view have no footer and are the only places the
artwork is actually handled.

**Icon artwork is generated, not committed.** `scripts/build-aws-icons.ts`
copies 299 service icons out of the `aws-icons` dependency into a gitignored
`public/aws-icons/`. The artwork is AWS's — permitted for drawing architecture
diagrams, with restrictions on redistribution — so it arrives as a dependency
rather than living in this repository.

**Cloudflare icons come from a UI kit, so they are curated and coloured.**
`scripts/build-cloudflare-icons.tsx` renders 105 icons out of
`@cloudflare/component-icon` (official, BSD-3-Clause) into
`public/cloudflare-icons/`. Three things differ from the AWS pipeline and each is
forced by the source: the package ships React components rather than SVG files,
so they are rendered rather than copied; it is a general interface kit rather
than an icon set, so `src/lib/cloudflare-icons/products.json` is an allowlist and
anything outside it never reaches the picker; and the art is monochrome, so
Cloudflare's orange is baked in at build time. The fill goes on an inner `<g>`
rather than the root `<svg>` — exports strip the outer element, and a fill living
there vanishes from every thumbnail. Rationale in
[`docs/adr/0003-cloudflare-icons.md`](docs/adr/0003-cloudflare-icons.md).

**One icon shape, one instance per set.** `shapes/icon-shape-util.tsx` holds the
whole implementation; `aws-icon` and `cloudflare-icon` are thin subclasses that
supply a type string, a migration sequence and a URL. Both must stay registered
in `shapes/index.ts`, which both canvases import — a set registered by the editor
and not the share view produces a diagram that works for its author and fails for
everyone holding the link.

## Database

Schema lives in `src/db/schema/`, migrations in `drizzle/`. Change the schema,
then:

```bash
bun run db:generate     # writes a new drizzle/NNNN_*.sql
bun run db:migrate      # applies it
```

Generated migration filenames get a random suffix; rename both the file and its
`tag` in `drizzle/meta/_journal.json` to keep the directory readable.

Row-level security is enabled on every table with **no** policies. Supabase
exposes every `public` table through PostgREST using the project's anon key; this
app never uses PostgREST, reaching Postgres directly server-side, which bypasses
RLS. Enabling it with an empty policy set therefore costs nothing and makes the
tables unreachable if the anon key ever leaks.

## Deployment

Vercel, using the default `bun run build`. Two things are load-bearing.

### Next is pinned to 16.2.12

**Do not upgrade to 16.3.x without re-testing the deploy.** Bun 1.3.14 segfaults
during `next build`'s "Collecting page data" phase on Next.js 16.3.0 — an open
bug on the Linux x64 baseline build Vercel uses
([oven-sh/bun#36866](https://github.com/oven-sh/bun/issues/36866)). The build
prints its full route table and *then* dies with `panic: Segmentation fault`.

Building with Node instead of Bun is the other documented workaround, but it is
not available here: Vercel's Bun build image has no `node` on `PATH`, so
`./node_modules/.bin/next` fails its `#!/usr/bin/env node` shebang with
`env: 'node': No such file or directory`. That absence is also *why* the crash
happens at all — `bun run build` cannot find Node to execute `next`, so it falls
back to running it under Bun's own runtime.

Once the Bun bug is fixed, unpinning `next` and `eslint-config-next` together is
all that should be needed.

### The icon step must run before `next build`

`public/aws-icons/` is gitignored and generated from the `aws-icons` dependency;
skip the script and every AWS icon 404s in production *without the build
failing*. It is chained explicitly inside the `build` script rather than through
a `prebuild` hook, because Bun does not run those the way npm does.

## Working in this repo

[`AGENTS.md`](AGENTS.md) is the contract — conventions, structure, patterns and
invariants, written to be read in full before any change. It is the operating
manual; this README is the rationale. Keep both current.

Three kinds of document, deliberately distinct:

| Where | What it holds |
| --- | --- |
| [`docs/adr/`](docs/adr) | **Decisions** — one per change, written *before* implementing, append-only. Start from [`0000-template.md`](docs/adr/0000-template.md). |
| [`docs/superpowers/specs/`](docs/superpowers/specs) | Feature designs, for work large enough to need one |
| [`docs/superpowers/plans/`](docs/superpowers/plans) | Implementation plans |

Changes are reviewed as one whole diff and committed by hand, so nothing in this
repo is committed automatically.
