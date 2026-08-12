# WorkOS Auth + Supabase Postgres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add global WorkOS AuthKit authentication to tools.puncoz.com, backed by a Supabase Postgres `users` table with committed Drizzle migrations, and require sign-in to reach `/draw`.

**Architecture:** A root `proxy.ts` (Next.js 16's replacement for `middleware.ts`) keeps the AuthKit session cookie fresh on every request. Tools live under a `src/app/(tools)/` route group whose layout and pages both call a `requireAuth()` helper that redirects to an in-app `/login` page. On successful sign-in, `handleAuth`'s `onSuccess` hook upserts the WorkOS user into Postgres through Drizzle. Supabase is used purely as managed Postgres — no Supabase Auth, no `supabase-js`, no PostgREST.

**Tech Stack:** Next.js 16.3 (App Router, React 19), `@workos-inc/authkit-nextjs@4.3.1`, `@workos-inc/node@10.9.0`, `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10`, `postgres@3.4.9` (postgres.js), Bun 1.3, Tailwind v4.

## Global Constraints

- **Do not run `git commit`.** The user commits manually after review. Every task ends with a verification step, never a commit step.
- **No test framework exists in this repo, and adding one is out of scope.** This plan therefore substitutes typecheck + build verification for the usual TDD red/green cycle. Where behaviour cannot be verified without credentials, the step says so explicitly and the result must be reported as unverified.
- **Package manager is Bun.** `npm`/`yarn`/`pnpm` are blocked by the `engines` field. Bun auto-loads `.env.local`, which is how `drizzle-kit` receives `DIRECT_URL`.
- **Code style, matching the existing codebase:** double quotes, no semicolons, 2-space indent, arrow-function components, `export default <Name>` on the last line, `@/*` path alias for `src/*`.
- **Async server components must not be typed `FunctionComponent`** — that type cannot return a Promise. Type props inline instead.
- **Exact API signatures** (verified against installed `.d.ts` files, these differ from the published docs):
  - `getSignInUrl({ returnTo })` — `returnTo`, **not** `returnPathname`.
  - `signOut({ returnTo })`.
  - `withAuth()` → `Promise<UserInfo | NoUserInfo>`; `.user` is `User | null`.
  - `handleAuth({ returnPathname, onSuccess, onError })`; `onSuccess` receives `{ user, accessToken, refreshToken, ... }`; `onError` receives `{ error, request }` and must return a `Response`.
  - `authkitProxy(options?)` is the Next 16 API; `authkitMiddleware` is a deprecated alias of it.
  - Redirect URI env var is read as `NEXT_PUBLIC_WORKOS_REDIRECT_URI`.
  - WorkOS `User` fields: `id`, `email`, `emailVerified`, `profilePictureUrl`, `name`, `firstName`, `lastName`, `lastSignInAt`, `locale`, `createdAt`, `updatedAt`. All the name/picture fields are `string | null`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `proxy.ts` | Root request interception; session refresh only. |
| `drizzle.config.ts` | drizzle-kit config; points at `DIRECT_URL`. |
| `.env.example` | Documents all six required env vars. |
| `src/lib/env.ts` | `requireEnv()`, `assertAuthEnv()` — lazy env validation with named errors. |
| `src/db/schema/users.ts` | `users` table + `DbUser`/`NewDbUser` types. |
| `src/db/schema/index.ts` | Schema barrel for drizzle-kit and the client. |
| `src/db/index.ts` | `getDb()` — lazy, HMR-safe Drizzle client. |
| `drizzle/*.sql` | Generated + hand-written migrations (committed). |
| `src/lib/auth/session.ts` | `getCurrentUser()`, `requireAuth()`. Knows nothing about the database. |
| `src/lib/auth/sync-user.ts` | `syncUser()` upsert. Knows nothing about routing. |
| `src/lib/auth/actions.ts` | `signOutAction()` server action. |
| `src/app/auth/callback/route.ts` | OAuth code exchange; wires callback → `syncUser`. |
| `src/app/login/page.tsx` | Sign-in entry point. |
| `src/components/auth/user-menu.tsx` | Header auth affordance. |
| `src/components/tools/draw-canvas.tsx` | The `"use client"` tldraw mount, extracted from the old page. |
| `src/app/(tools)/layout.tsx` | Defense-in-depth guard for all tools. |
| `src/app/(tools)/draw/page.tsx` | Server page: guard + render canvas. |
| `src/app/(tools)/notes/page.tsx` | Moved for consistency. |

---

### Task 1: Environment plumbing

**Files:**
- Create: `.env.example`
- Create: `src/lib/env.ts`
- Modify: `.gitignore` (un-ignore `.env.example`)

**Interfaces:**
- Consumes: nothing.
- Produces: `requireEnv(name: string): string`, `assertAuthEnv(): void`.

- [ ] **Step 1: Un-ignore the example env file**

`.gitignore` currently has `.env*`, which would swallow `.env.example`. Under the `# env files` comment, change the block to:

```gitignore
# env files (can opt-in for committing if needed)
.env*
!.env.example
```

- [ ] **Step 2: Create `.env.example`**

```sh
# WorkOS AuthKit — https://dashboard.workos.com
WORKOS_API_KEY=
WORKOS_CLIENT_ID=
# 32+ characters. Generate with: openssl rand -base64 24
WORKOS_COOKIE_PASSWORD=
# Must be registered verbatim in the WorkOS dashboard for every origin.
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback

# Supabase Postgres — Project Settings > Database > Connection string
# Transaction pooler (port 6543). Used at runtime.
DATABASE_URL=
# Direct connection (port 5432). Used by drizzle-kit for migrations only.
DIRECT_URL=
```

- [ ] **Step 3: Create `src/lib/env.ts`**

Validation is lazy — called from within functions, never at module top level — so that `next build` succeeds on a machine without credentials.

```ts
const requireEnv = (name: string): string => {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See .env.example.`)
  }

  return value
}

const AUTH_ENV_VARS = [
  "WORKOS_API_KEY",
  "WORKOS_CLIENT_ID",
  "WORKOS_COOKIE_PASSWORD",
  "NEXT_PUBLIC_WORKOS_REDIRECT_URI",
] as const

/**
 * AuthKit reads its own env vars and falls back to empty strings, which surfaces
 * as an opaque API error. Check them up front so the failure names the culprit.
 */
const assertAuthEnv = (): void => {
  const missing = AUTH_ENV_VARS.filter(name => !process.env[name])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}. See .env.example.`)
  }
}

export { assertAuthEnv, requireEnv }
```

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 2: Database schema, client, and migrations

**Files:**
- Create: `src/db/schema/users.ts`, `src/db/schema/index.ts`, `src/db/index.ts`, `drizzle.config.ts`
- Generate: `drizzle/0000_*.sql`, `drizzle/0001_*.sql`, `drizzle/meta/*`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `requireEnv` from Task 1.
- Produces: `getDb()`, the `users` table object, `DbUser`, `NewDbUser`.

- [ ] **Step 1: Add `server-only` as an explicit dependency**

It is currently only a transitive dep of authkit. Server modules import it directly, so declare it.

Run: `bun add server-only`

- [ ] **Step 2: Create `src/db/schema/users.ts`**

Types are named `DbUser`/`NewDbUser` to avoid colliding with WorkOS's `User`.

```ts
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

/**
 * Local mirror of a WorkOS user. `id` is ours so future tables reference a local
 * key rather than coupling to the identity provider; `workosId` is the join key.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workosId: text("workos_id").notNull().unique(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profilePictureUrl: text("profile_picture_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
}, table => [
  index("users_email_idx").on(table.email),
])

export type DbUser = typeof users.$inferSelect
export type NewDbUser = typeof users.$inferInsert
```

- [ ] **Step 3: Create `src/db/schema/index.ts`**

```ts
export * from "./users"
```

- [ ] **Step 4: Create `src/db/index.ts`**

The client is created on first use, not at import time, so builds without `DATABASE_URL` still succeed. It is cached on `globalThis` so hot reload does not leak a connection pool per edit. `prepare: false` is mandatory — Supabase's transaction pooler does not support prepared statements.

```ts
import "server-only"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "@/db/schema"
import { requireEnv } from "@/lib/env"

const createDatabase = () => {
  const client = postgres(requireEnv("DATABASE_URL"), { prepare: false })

  return drizzle(client, { schema })
}

type Database = ReturnType<typeof createDatabase>

const globalForDb = globalThis as unknown as { toolsDb?: Database }

export const getDb = (): Database => (globalForDb.toolsDb ??= createDatabase())
```

- [ ] **Step 5: Create `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
})
```

- [ ] **Step 6: Add database scripts to `package.json`**

Inside `"scripts"`, after `"lint"`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio"
```

- [ ] **Step 7: Generate the initial migration**

Run: `bunx drizzle-kit generate --name create_users`
Expected: `drizzle/0000_create_users.sql` containing `CREATE TABLE "users"`, a unique constraint on `workos_id`, and `CREATE INDEX "users_email_idx"`. Read the file and confirm before continuing.

- [ ] **Step 8: Generate an empty custom migration for RLS**

Run: `bunx drizzle-kit generate --custom --name enable_rls`

Then fill `drizzle/0001_enable_rls.sql` with:

```sql
-- Supabase exposes every table in `public` through PostgREST using the project's
-- publishable anon key. This app never uses PostgREST — all access is server-side
-- over a direct Postgres connection, which bypasses RLS. Enabling RLS with zero
-- policies therefore makes the table unreachable via the anon key at no cost.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 9: Verify**

Run: `bunx tsc --noEmit`
Expected: no errors.

Do **not** run `db:migrate` — it needs credentials that are not yet available. Note it as a follow-up for the user.

---

### Task 3: Session helpers

**Files:**
- Create: `src/lib/auth/session.ts`

**Interfaces:**
- Consumes: `assertAuthEnv` from Task 1.
- Produces: `getCurrentUser(): Promise<User | null>`, `requireAuth(returnTo: string): Promise<User>` — both re-exporting WorkOS's `User` type from `@workos-inc/node`.

- [ ] **Step 1: Create `src/lib/auth/session.ts`**

```ts
import "server-only"
import { withAuth } from "@workos-inc/authkit-nextjs"
import type { User } from "@workos-inc/node"
import { redirect } from "next/navigation"
import { assertAuthEnv } from "@/lib/env"

/** Returns the signed-in user, or null. Use on pages that work either way. */
const getCurrentUser = async (): Promise<User | null> => {
  assertAuthEnv()

  const { user } = await withAuth()

  return user
}

/**
 * Guards a route. Next.js layouts do not re-run on client-side navigation, so
 * this must be called by the page itself — a layout-only check is not a
 * security boundary.
 *
 * @param returnTo Path to send the user back to after signing in.
 */
const requireAuth = async (returnTo: string): Promise<User> => {
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`)
  }

  return user
}

export { getCurrentUser, requireAuth }
export type { User }
```

- [ ] **Step 2: Verify**

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 4: User sync and the AuthKit callback

**Files:**
- Create: `src/lib/auth/sync-user.ts`, `src/app/auth/callback/route.ts`, `proxy.ts`

**Interfaces:**
- Consumes: `getDb`, `users` (Task 2).
- Produces: `syncUser(workosUser: User): Promise<void>`.

- [ ] **Step 1: Create `src/lib/auth/sync-user.ts`**

```ts
import "server-only"
import type { User } from "@workos-inc/node"
import { sql } from "drizzle-orm"
import { getDb } from "@/db"
import { users } from "@/db/schema"

/**
 * Mirrors a WorkOS user into Postgres. Called once per sign-in, so profile
 * changes made in WorkOS propagate on the user's next visit.
 */
const syncUser = async (workosUser: User): Promise<void> => {
  await getDb()
    .insert(users)
    .values({
      workosId: workosUser.id,
      email: workosUser.email,
      emailVerified: workosUser.emailVerified,
      firstName: workosUser.firstName,
      lastName: workosUser.lastName,
      profilePictureUrl: workosUser.profilePictureUrl,
      lastSignInAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.workosId,
      set: {
        email: sql`excluded.email`,
        emailVerified: sql`excluded.email_verified`,
        firstName: sql`excluded.first_name`,
        lastName: sql`excluded.last_name`,
        profilePictureUrl: sql`excluded.profile_picture_url`,
        lastSignInAt: sql`excluded.last_sign_in_at`,
        updatedAt: new Date(),
      },
    })
}

export { syncUser }
```

- [ ] **Step 2: Create `src/app/auth/callback/route.ts`**

A database outage must not block sign-in: identity lives in WorkOS and the local row is a cache that is rewritten on the next sign-in.

```ts
import { handleAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"
import { syncUser } from "@/lib/auth/sync-user"

export const GET = handleAuth({
  returnPathname: "/",
  onSuccess: async ({ user }) => {
    try {
      await syncUser(user)
    } catch (error) {
      // The local row is a cache, not the source of truth. Never fail sign-in on it.
      console.error("[auth] failed to sync user to database", error)
    }
  },
  onError: ({ error, request }) => {
    console.error("[auth] callback failed", error)

    return NextResponse.redirect(new URL("/login?error=callback", request.url))
  },
})
```

- [ ] **Step 3: Create `proxy.ts` at the project root**

Next.js 16 replaces `middleware.ts` with `proxy.ts`. This runs `authkitProxy()` with no `middlewareAuth` — the proxy only refreshes the session cookie; route protection is the pages' job via `requireAuth()`, so unauthenticated users land on `/login` rather than being bounced straight to AuthKit.

```ts
import { authkitProxy } from "@workos-inc/authkit-nextjs"

export default authkitProxy()

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
```

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 5: Login page and sign-out action

**Files:**
- Create: `src/app/login/page.tsx`, `src/lib/auth/actions.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (Task 3).
- Produces: `signOutAction(): Promise<void>`.

- [ ] **Step 1: Create `src/lib/auth/actions.ts`**

```ts
"use server"

import { signOut } from "@workos-inc/authkit-nextjs"

const signOutAction = async (): Promise<void> => {
  await signOut({ returnTo: "/" })
}

export { signOutAction }
```

- [ ] **Step 2: Create `src/app/login/page.tsx`**

`returnTo` arrives from the query string and is fed to a redirect, so it must be validated — accepting an arbitrary value would be an open redirect. Only same-origin absolute paths pass; `//evil.com` is rejected because a protocol-relative URL is a different origin.

In Next.js 16, `searchParams` is a Promise and must be awaited.

```tsx
import { getSignInUrl } from "@workos-inc/authkit-nextjs"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"

type Props = {
  searchParams: Promise<{ returnTo?: string, error?: string }>
}

/** Rejects anything that is not a same-origin absolute path (open redirect guard). */
const safeReturnTo = (value: string | undefined): string =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/"

const LoginPage = async ({ searchParams }: Props) => {
  const { returnTo, error } = await searchParams
  const destination = safeReturnTo(returnTo)
  const user = await getCurrentUser()

  if (user) {
    redirect(destination)
  }

  const signInUrl = await getSignInUrl({ returnTo: destination })

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-card-foreground">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          These tools are private. Sign in to continue.
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Something went wrong signing you in. Please try again.
          </p>
        )}

        <a
          href={signInUrl}
          className="mt-6 flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Continue
        </a>
      </div>
    </div>
  )
}

export default LoginPage
```

- [ ] **Step 3: Verify**

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 6: Root layout provider and the header

**Files:**
- Create: `src/components/auth/user-menu.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` (Task 3), `signOutAction` (Task 5).
- Produces: `<UserMenu />` — an async server component taking no props.

- [ ] **Step 1: Create `src/components/auth/user-menu.tsx`**

An async server component so it can read the session itself; both the home page and any future chrome can drop it in with no props.

```tsx
import Link from "next/link"
import { signOutAction } from "@/lib/auth/actions"
import { getCurrentUser } from "@/lib/auth/session"

const UserMenu = async () => {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{user.firstName ?? user.email}</span>

      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}

export default UserMenu
```

- [ ] **Step 2: Wrap the root layout in `AuthKitProvider`**

In `src/app/layout.tsx`, add the import and wrap the existing `<main>`. `AuthKitProvider` comes from the `/components` subpath export, not the package root.

```tsx
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components"
```

Replace the body contents so `<main>{children}</main>` is wrapped:

```tsx
    <body className={`${inter.variable}`}>
    <AuthKitProvider>
      <main>
        {children}
      </main>
    </AuthKitProvider>

    <SpeedInsights/>
    <Analytics/>
    </body>
```

- [ ] **Step 3: Add the header to the home page**

`src/app/page.tsx` stays public. Add the `UserMenu` in a header above the existing tool grid, preserving the current centred layout:

```tsx
import UserMenu from "@/components/auth/user-menu"
import { HoverEffect } from "@/components/ui/card-hover-effect"

const tools = [
  {
    active: true,
    title: "Draw",
    description: "Drawing tools to help you draw diagrams and notes",
    link: "/draw",
  },
  {
    active: false,
    title: "Editor",
    description: "Notion like editor to help you write notes",
    link: "/notes",
  },
]

const HomePage = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold">tools.puncoz.com</span>

        <UserMenu/>
      </header>

      <div className="flex w-full flex-1 items-center justify-center">
        <HoverEffect items={tools.filter(tool => tool.active)}/>
      </div>
    </div>
  )
}

export default HomePage
```

- [ ] **Step 4: Verify**

Run: `bunx tsc --noEmit`
Expected: no errors.

---

### Task 7: Route group and gating `/draw`

**Files:**
- Create: `src/app/(tools)/layout.tsx`, `src/components/tools/draw-canvas.tsx`, `src/app/(tools)/draw/page.tsx`
- Move: `src/app/notes/page.tsx` → `src/app/(tools)/notes/page.tsx`
- Delete: `src/app/draw/page.tsx`, `src/app/notes/` (after moving)

**Interfaces:**
- Consumes: `requireAuth` (Task 3).
- Produces: the `(tools)` route group convention — any future tool placed here inherits the guard by calling `requireAuth("/<path>")` in its page.

Route groups do not affect URLs: `/draw` and `/notes` are unchanged.

- [ ] **Step 1: Create `src/app/(tools)/layout.tsx`**

The layout cannot read the current pathname, so it passes `/` as the fallback return path; each page supplies its own accurate one. This check is defense-in-depth — the page-level call is the real guarantee.

```tsx
import React from "react"
import { requireAuth } from "@/lib/auth/session"

type Props = Readonly<{
  children: React.ReactNode
}>

const ToolsLayout = async ({ children }: Props) => {
  await requireAuth("/")

  return <>{children}</>
}

export default ToolsLayout
```

- [ ] **Step 2: Extract the tldraw canvas into a client component**

Create `src/components/tools/draw-canvas.tsx` with the exact contents of the current `src/app/draw/page.tsx`, renamed:

```tsx
"use client"

import { FunctionComponent } from "react"
import { Tldraw } from "tldraw"
import "tldraw/tldraw.css"

const DrawCanvas: FunctionComponent = () => {
  return (
    <div className="fixed inset-0">
      <Tldraw persistenceKey="tools.puncoz.com"/>
    </div>
  )
}

export default DrawCanvas
```

- [ ] **Step 3: Create the guarded server page**

Create `src/app/(tools)/draw/page.tsx`. Keeping the guard in a server page means the check never ships to the browser:

```tsx
import DrawCanvas from "@/components/tools/draw-canvas"
import { requireAuth } from "@/lib/auth/session"

const DrawPage = async () => {
  await requireAuth("/draw")

  return <DrawCanvas/>
}

export default DrawPage
```

- [ ] **Step 4: Delete the old draw page**

Run: `rm -rf src/app/draw`

- [ ] **Step 5: Move the notes page and add its guard**

Read the existing `src/app/notes/page.tsx` first. Move it to `src/app/(tools)/notes/page.tsx`. If it is a client component, apply the same split as `/draw` (client body in `src/components/tools/`, server page calling `await requireAuth("/notes")`). If it is already a server component, add `await requireAuth("/notes")` as its first statement.

Then run: `rm -rf src/app/notes`

- [ ] **Step 6: Verify**

Run: `bunx tsc --noEmit && bun run lint`
Expected: no errors.

---

### Task 8: Full verification and handoff notes

**Files:** none.

- [ ] **Step 1: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Production build**

Run: `bun run build`
Expected: build succeeds. `/`, `/login`, `/draw`, `/notes` all compile. Routes reading the session are expected to be marked dynamic — that is correct, not a warning to fix.

- [ ] **Step 3: Confirm migration files exist and are readable**

Run: `ls drizzle && cat drizzle/0000_create_users.sql drizzle/0001_enable_rls.sql`
Expected: both files present with the SQL described in Task 2.

- [ ] **Step 4: Report unverified items honestly**

The following cannot be verified without credentials and must be reported to the user as outstanding, not as done:

1. `bun run db:migrate` has not been run — no Supabase connection string available.
2. No live sign-in has been performed.
3. The WorkOS dashboard must have `http://localhost:3000/auth/callback` registered as a redirect URI.

Provide the user the manual smoke test to run once `.env.local` is filled in:

```
1. bun run db:migrate          # creates the users table
2. bun run dev
3. Visit /draw signed out      -> expect redirect to /login?returnTo=%2Fdraw
4. Click Continue              -> AuthKit hosted UI -> back to /draw
5. Check Supabase table editor -> one row in public.users
6. Home page -> Sign out       -> /draw redirects to /login again
```

- [ ] **Step 5: Do not commit**

Leave all changes in the working tree. Report the file list so the user can review and commit manually.

---

## Self-Review

**Spec coverage:** Auth flow (Tasks 3–5, 7) · proxy.ts (Task 4) · callback + user sync (Task 4) · login page (Task 5) · session helpers (Task 3) · AuthKitProvider (Task 6) · sign-out (Tasks 5–6) · `(tools)` route group (Task 7) · `users` table (Task 2) · RLS (Task 2) · two connection strings (Tasks 1–2) · lazy env validation (Task 1) · `.env.example` (Task 1) · verification (Task 8). No gaps.

**Deviations from spec, deliberate:** The spec described a shared header in the tools layout; the plan drops it. `/draw` is a fullscreen `fixed inset-0` canvas and a header would either overlap tldraw's own UI or force a layout rework — out of scope for "gate the tool behind login". The tools layout is guard-only; the header lives on the public home page. The spec also listed `email_verified` implicitly via the WorkOS user shape; it is included in the table since the field is free.

**Type consistency:** `getDb()` (not `db`) is used consistently in Tasks 2 and 4. `DbUser`/`NewDbUser` avoid colliding with WorkOS `User`. `requireAuth(returnTo)` takes one string argument everywhere it is called (Tasks 5, 7). `syncUser(user)` matches the `onSuccess` destructure in Task 4.

**No placeholders:** every code step contains complete, runnable content.

---

## Amendments (post-execution)

The plan was executed as written, then changed by follow-up requests. Where the code blocks above
disagree with the repository, the repository is correct.

1. **`src/lib/env.ts` was replaced by a `src/config/` layer.** `src/config/env.ts` (server-only, the
   low-level `requireEnv`/`missingEnv` helpers), `src/config/server.ts` (`serverConfig` — database
   URL and WorkOS credentials, exposed as lazily-evaluated getters), and `src/config/client.ts`
   (`clientConfig` — app metadata plus the public redirect URI). Application code reads config
   objects; only `src/config/` touches `process.env`. `drizzle.config.ts` is the documented
   exception, because it is loaded by the drizzle-kit CLI outside Next and must tolerate an
   entirely unconfigured database.
2. **Route segment config.** `/`, `/login`, and `(tools)/layout.tsx` export
   `dynamic = "force-dynamic"`. They render per-user auth state, and without this the env check
   throws during the static prerender pass before the cookie read that would otherwise mark them
   dynamic.
3. **Toolchain downgrades.** `typescript` 7.0.2 → 6.0.3 and `eslint` 10.8.1 → 9.39.5, both pinned.
   `typescript-eslint` requires `<6.1.0`, and `eslint-plugin-react@7.37.5` (latest, a transitive
   dependency of `eslint-config-next`) supports only `eslint <=9.x`.
4. **Lint stack.** `eslint.config.mjs` dropped `FlatCompat` in favour of `eslint-config-next`'s
   flat config exports, `@eslint/eslintrc` was removed, and the `lint` script became `eslint .`
   because `next lint` no longer exists in Next 16.
5. **`tsconfig.json`.** `baseUrl` removed (TypeScript 7 rejects it; `paths` resolve relative to the
   config file without it).
