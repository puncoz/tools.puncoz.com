# tools.puncoz.com

A personal collection of small web tools behind a single sign-in.

| Tool | Route | Status |
| --- | --- | --- |
| **Draw** — infinite tldraw canvas for diagrams and sketches, with AWS architecture icons | `/draw` | live |
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

Missing variables are caught at boot by `src/instrumentation.ts` rather than at
the first call site, so the app fails fast with a list of what is absent.

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Build AWS icons, then start the dev server |
| `bun run build` | Build AWS icons, then build for production |
| `bun run lint` | ESLint |
| `bun run db:generate` | Generate a migration from schema changes |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:studio` | Drizzle Studio |
| `bun run icons:build` | Regenerate `public/aws-icons/` on its own |

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

**`src/proxy.ts`, not the repo root.** Next 16 replaces `middleware.ts` with
`proxy.ts`, and in a `src/` project it must live in `src/` or it is silently
ignored. Every authenticated route must stay inside its matcher: `withAuth`
throws outright on a path the AuthKit proxy does not cover.

**Drawings persist as tldraw snapshots.** `@tldraw/sync` needs a persistent
WebSocket and does not run on Vercel, so the canvas autosaves a document snapshot
on a debounce instead. Gallery previews are rendered in the browser and stored as
a size-capped WebP.

**Object storage is optional and per-account.** Users can point the draw tool at
their own S3, Cloudflare R2 or Supabase Storage bucket under
`/settings/storage`. Uploads go browser-to-bucket through presigned URLs, which
keeps images clear of Vercel's 4.5 MB request cap. Without a bucket configured,
images embed as data URLs and a document size guard warns before saving breaks.

**Share links are opt-in and revocable.** `/s/<token>` renders a drawing
read-only to anyone holding the link, without a sign-in. Sharing is off per
drawing until switched on, and revoking takes effect on the next request.

**AWS icons are generated, not committed.** `scripts/build-aws-icons.ts` copies
299 service icons out of the `aws-icons` dependency into a gitignored
`public/aws-icons/`. The artwork is AWS's — permitted for drawing architecture
diagrams, with restrictions on redistribution — so it arrives as a dependency
rather than living in this repository.

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

Vercel, with the build command overridden in [`vercel.json`](vercel.json):

```
bun scripts/build-aws-icons.ts && ./node_modules/.bin/next build
```

Two things are load-bearing.

**Next is built with Node, not Bun.** Bun 1.3.14 segfaults during `next build`'s
"Collecting page data" phase on Next.js 16.3.0 — an open bug on the Linux x64
baseline build Vercel uses ([oven-sh/bun#36866](https://github.com/oven-sh/bun/issues/36866)).
The default `bun run build` hands `next` to Bun's runtime and the build dies with
`panic: Segmentation fault` *after* printing its route table. Invoking
`./node_modules/.bin/next` runs it under Node via its shebang. Bun still installs
dependencies and still runs the icon script, which is TypeScript. If this ever
resurfaces, the other known workaround is pinning Next to 16.2.12.

**The icon step must run before `next build`.** `public/aws-icons/` is gitignored
and generated from the `aws-icons` dependency; skip the script and every AWS icon
404s in production *without the build failing*. It is chained explicitly rather
than through a `prebuild` hook, because Bun does not run those the way npm does.

If Vercel's dashboard has a Build Command set, clear it — `vercel.json` should be
the single source of truth.

## Working in this repo

[`AGENTS.md`](AGENTS.md) carries instructions for coding agents. Design documents
for each feature are in [`docs/superpowers/specs/`](docs/superpowers/specs).
