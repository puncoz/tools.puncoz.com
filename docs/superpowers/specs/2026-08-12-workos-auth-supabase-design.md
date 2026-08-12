# WorkOS Auth + Supabase Postgres — Design

**Date:** 2026-08-12
**Status:** Approved
**Scope:** Global authentication for tools.puncoz.com via WorkOS AuthKit, backed by a Supabase
Postgres database with versioned Drizzle migrations. Gate the existing `/draw` tool behind login.

## Goals

1. One global auth mechanism that every current and future tool on this site inherits.
2. A Postgres database (Supabase) with migration files committed to the repo.
3. `/draw` (tldraw) requires a signed-in user.

## Non-goals

Deliberately excluded from this pass, to be revisited later:

- Persisting tldraw documents to Postgres. Drawings stay in browser IndexedDB via tldraw's
  `persistenceKey`. The database stores users only.
- WorkOS Organizations / multi-tenancy. This is a personal tools site with a flat user model.
- Roles, permissions, or per-tool authorization. Signed in means access to every tool.
- Supabase Auth, `supabase-js`, PostgREST, and Supabase Realtime. Supabase is used purely as
  managed Postgres; WorkOS owns identity.
- A test framework. The repo has none, and introducing one is separate work.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Identity provider | WorkOS AuthKit, hosted sign-in UI | Requested. Hosted UI means no password/OAuth UI to build or maintain. |
| Next.js integration | `@workos-inc/authkit-nextjs@^4.3.1` | Version 4.3.1 declares `next: ^16` support; this repo runs Next 16.3. |
| Request interception | `proxy.ts` with `authkitProxy()` | Next.js 16 replaces `middleware.ts` with `proxy.ts`. `authkitMiddleware` is the ≤15 API and does not apply here. |
| Route protection | Per-page `requireAuth()` inside a `(tools)` route group | Next.js layouts do not re-run on every client-side navigation, so a layout check alone is not a security boundary. The page-level call is the guarantee; the layout call is defense-in-depth and hosts shared chrome. |
| Unauthenticated UX | Redirect to an in-app `/login` page | Chosen over redirecting straight to AuthKit, so the app can explain itself and preserve the return path. |
| Database access | Drizzle ORM over `postgres.js` | Chosen over the Supabase CLI + `supabase-js` workflow for end-to-end type safety and a single TypeScript source of truth for the schema. |
| Migrations | `drizzle-kit generate` → `drizzle/*.sql`, committed | Versioned, reviewable SQL checked into the repo. |
| User sync | Upsert in `handleAuth`'s `onSuccess` hook | The documented extension point; fires exactly once per sign-in, so no per-request write. |

## Architecture

### Authentication flow

```
Anonymous visitor
  └─ GET /                      → public. Header renders "Sign in" → /login
  └─ GET /draw                  → requireAuth() finds no session
                                → redirect /login?returnTo=/draw
       └─ GET /login            → renders card, link to getSignInUrl({ returnPathname })
            └─ AuthKit hosted UI (workos.com)
                 └─ GET /auth/callback?code=…
                      → handleAuth() exchanges code, seals session cookie
                      → onSuccess: upsert users row (by workos_id)
                      → redirect back to returnPathname (/draw)
```

Every request additionally passes through `proxy.ts`, which refreshes and re-seals the session
cookie so sessions do not expire mid-visit.

### Components

| File | Responsibility | Depends on |
| --- | --- | --- |
| `proxy.ts` | Session refresh on every non-static request | `authkitProxy` |
| `src/app/auth/callback/route.ts` | OAuth code exchange; triggers user sync | `handleAuth`, `syncUser` |
| `src/app/login/page.tsx` | Sign-in entry point; bounces already-authed users | `getSignInUrl`, `getCurrentUser` |
| `src/lib/auth/session.ts` | `requireAuth()`, `getCurrentUser()` | `withAuth` |
| `src/lib/auth/sync-user.ts` | `syncUser(workosUser)` upsert | `db`, `users` schema |
| `src/lib/auth/actions.ts` | `signOutAction()` server action | `signOut` |
| `src/components/auth/user-menu.tsx` | Header auth affordance | `signOutAction` |
| `src/app/(tools)/layout.tsx` | Shared tool chrome + defense-in-depth guard | `requireAuth` |
| `src/db/index.ts` | Drizzle client singleton | `postgres.js`, schema |
| `src/db/schema/users.ts` | `users` table definition | drizzle-orm |

Each unit is independently readable: `session.ts` knows nothing about the database, `sync-user.ts`
knows nothing about routing, and `db/index.ts` knows nothing about auth.

### Route layout

`/draw` and `/notes` move into `src/app/(tools)/`. Route groups do not affect URLs, so public paths
are unchanged. Adding a future tool means creating `src/app/(tools)/<tool>/page.tsx` and calling
`requireAuth()` in it — auth is inherited, not re-implemented.

`/draw/page.tsx` is a `"use client"` tldraw mount. It becomes a server page that calls
`requireAuth()` and renders a client `<DrawCanvas />`, keeping the guard on the server.

## Data model

Table `public.users`:

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `workos_id` | `text` | NOT NULL, UNIQUE — the WorkOS `user.id` |
| `email` | `text` | NOT NULL |
| `first_name` | `text` | nullable |
| `last_name` | `text` | nullable |
| `profile_picture_url` | `text` | nullable |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |
| `last_sign_in_at` | `timestamptz` | nullable |

Index on `email`. The app's own `id` is separate from `workos_id` so future tables reference a local
key and are not coupled to the identity provider.

### Row Level Security

The initial migration runs `ALTER TABLE users ENABLE ROW LEVEL SECURITY;` and defines no policies.
Supabase projects expose every `public` table through PostgREST using a publishable anon key. Since
this app never uses PostgREST, RLS with zero policies makes the table unreachable by that key, while
the direct `postgres` connection Drizzle uses bypasses RLS as normal.

## Connections

Two connection strings, the standard Supabase + Drizzle split:

- `DATABASE_URL` — transaction pooler (port 6543), used at runtime. `postgres.js` must be created
  with `prepare: false`; the transaction pooler does not support prepared statements.
- `DIRECT_URL` — direct connection (port 5432), used by `drizzle-kit` for DDL. Migrations run
  outside a pooled session.

The Drizzle client is memoised on `globalThis` so Next.js hot reload does not open a new pool per
edit.

## Environment variables

```sh
WORKOS_API_KEY=
WORKOS_CLIENT_ID=
WORKOS_COOKIE_PASSWORD=              # 32+ chars: openssl rand -base64 24
NEXT_PUBLIC_WORKOS_REDIRECT_URI=     # http://localhost:3000/auth/callback
DATABASE_URL=                        # Supabase transaction pooler, port 6543
DIRECT_URL=                          # Supabase direct connection, port 5432
```

`.env.example` is committed with these keys and empty values. `.env*.local` stays git-ignored. The
same redirect URI must be registered in the WorkOS dashboard for every origin (localhost and
production).

## Error handling

| Failure | Behaviour |
| --- | --- |
| Missing/invalid session on a tool route | Redirect to `/login?returnTo=<path>`. No error surfaced. |
| AuthKit callback error (denied, expired code) | `handleAuth`'s `onError` redirects to `/login?error=<code>`; the page renders an inline message. |
| Database unreachable during `onSuccess` sync | Log and let sign-in succeed. Identity lives in WorkOS; the local row is a cache and is re-upserted on next sign-in. Auth must not hard-fail on a database blip. |
| Missing env vars | `src/config/` is the only place that reads `process.env`. Values are exposed as getters on `serverConfig` / `clientConfig` and validated on first use, throwing an error that names the missing var rather than failing obscurely. Validation is deliberately lazy, not at import time, so `next build` succeeds without credentials. |

## Verification

The repo has no test framework, so verification is:

1. `bunx tsc --noEmit` — typecheck clean.
2. `bun run build` — production build passes.
3. `bunx drizzle-kit generate` — produces a reviewable SQL migration.
4. Manual smoke test once credentials are supplied: anonymous `/draw` redirects to `/login`;
   sign-in returns to `/draw`; a `users` row exists; sign-out re-gates `/draw`.

Steps 3 and 4 require credentials the author does not have at implementation time and will be
reported as unverified until run.
