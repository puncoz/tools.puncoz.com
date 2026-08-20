# AGENTS.md — read this before touching anything

**This file is the contract for working in this repository. Read it in full at the
start of every task, before reading code, before planning, before editing.** It is
written so that most changes need no exploratory reading of the codebase: the map,
the conventions and the invariants are all here. If you find yourself spelunking to
answer a question this file should have answered, answer it, do the work, then add
the answer here — that gap is a defect in this file.

`CLAUDE.md` is a one-line include of this file. There is one source of truth.

---

## 1. Non-negotiables

1. **Never commit, never push.** Not "unless asked", not "at the end", not "just the
   docs". The author reviews every change as one whole diff and commits manually.
   Leave the tree dirty and say what you changed. Running `git add` is also out — a
   staged tree misrepresents the review state.
2. **Write an ADR before you change anything.** See §3. This applies to code,
   schema, config and dependencies.
3. **Update the docs in the same task.** `AGENTS.md`, `README.md`, the ADR, and any
   `.env.example` entry your change implies. A change that lands without its
   documentation is unfinished, not "to be tidied later".
4. **Never print or paste secrets.** `.env` holds live credentials. Read variable
   *names* freely; never echo a value into the transcript, a file, or a commit.
5. **Verify before reporting.** This repo has no test suite (§10). "It should work"
   is not a result. Report what you actually observed, including what you could not
   check.
6. **Ask before widening scope.** Adjacent bugs get reported, not silently fixed.

---

## 2. The working agreement

```
understand  →  ADR  →  approval  →  implement  →  verify  →  update docs  →  stop
```

- **Understand** using this file first. Open code only for the part you are changing.
- **ADR** — a short decision record in `docs/adr/`, written *before* implementing.
- **Approval** — for anything beyond a mechanical edit, state the approach in chat
  and wait. Present the design, then stop; do not present and start in one breath.
- **Implement** the agreed scope, and only that.
- **Verify** — `bunx tsc --noEmit`, `bun run lint`, and exercise the actual path in a
  browser when the change is user-visible.
- **Update docs**, then **stop without committing** and summarise.

For substantial features, the existing `docs/superpowers/` flow (spec → plan) still
applies and runs *alongside* the ADR — the ADR captures the decision, the spec
captures the design. Small changes need only the ADR.

---

## 3. ADRs — required, and required first

Every change starts with an Architecture Decision Record in **`docs/adr/`**, named
`NNNN-kebab-title.md` with the next free number. Copy `docs/adr/0000-template.md`.

An ADR is short — often under a page. It records **the decision and why**, plus what
was rejected and what it costs. It is not a design document and not a changelog.

- One decision per ADR. Superseding an old decision means a *new* ADR that says so,
  and a `Superseded by` line added to the old one. ADRs are append-only history;
  do not rewrite a decided record.
- Status is `Proposed` while you are waiting for approval, `Accepted` once the
  author agrees, `Superseded by NNNN` later.
- If a change turns out to have no decision in it — a typo, a copy fix — say so and
  skip the ADR rather than manufacturing one.

`docs/adr/` is for decisions. `docs/superpowers/specs/` is for feature designs and
`docs/superpowers/plans/` for implementation plans. They are different artefacts;
keep them apart.

---

## 4. What this is

A personal multi-tool site — `tools.puncoz.com`, titled "Dev Tools" — where every
tool sits behind one sign-in. Tools are declared in **`src/lib/tools.ts`**; the
landing grid, search index and category filters all derive from that list, so adding
a tool needs no UI change.

Live: **Draw** (`/draw`), a tldraw canvas with AWS architecture icons, per-drawing
sharing, soft delete and per-account object storage. Planned: **Notes** (`/notes`).

`README.md` carries the *rationale* for the significant decisions — palette, sharing
model, storage, analytics consent, deployment pins. **Do not duplicate it here.**
This file is how to work; the README is why things are the way they are. Read the
README's "Notable design decisions" before changing any behaviour it describes.

---

## 5. Stack, and the traps in it

| Thing | Version | What bites |
| --- | --- | --- |
| Next.js | **16.2.12, pinned** | Do not upgrade. Bun segfaults building 16.3.x on Vercel — README explains. |
| React | 19 | Server Components by default. |
| TypeScript | 6, `strict` | No `any`, no non-null `!` to silence an error. |
| Tailwind | 4 | CSS-first config in `src/assets/css/main.css`. No `tailwind.config.js`. |
| tldraw | 5 | Canvas UI is injected through component *zones*, not composed around. |
| Drizzle + `postgres.js` | — | `prepare: false` is mandatory (Supabase transaction pooler). |
| WorkOS AuthKit | 4 | `withAuth()` **throws** on paths outside the proxy matcher. |
| Bun | ≥1.3 | The package manager and script runner. Never `npm`/`yarn`/`pnpm`. |

**This is not the Next.js in your training data.** Version 16 renamed and moved
things. Before writing Next-specific code, read the relevant guide in
**`node_modules/next/dist/docs/`** — it is the docs for *this* installed version.
Heed deprecation notices there.

Specifics that catch every agent:

- **`src/proxy.ts`, not `middleware.ts`, and not the repo root.** In a `src/`
  project it must live in `src/` or it is silently ignored.
- **`params` and `searchParams` are Promises.** `const { id } = await params`.
- **Route handlers** export `const GET = async (...)` — typed `Promise<Response>`.
- **`metadataBase`, `robots`, `sitemap`, `manifest`, `opengraph-image`** are all
  file conventions under `src/app/`. They already exist; extend rather than replace.

---

## 6. Repository map

```
src/
  app/                    routes only — thin; logic belongs in lib/
    (legal)/              privacy, terms          — public
    (tools)/              draw, notes, settings   — layout requires a session
    admin/                user review             — requireAdmin()
    account/              access status / reapply — reachable when NOT approved
    api/                  route handlers
    s/[token]/            public read-only share view + its OG image
    layout.tsx            root shell, theme pre-paint script, analytics
  assets/css/main.css     Tailwind v4 config, palette, base layer
  components/
    ui/                   generic primitives — button, menu, page-shell, theme-menu
    tools/draw/           canvas chrome, hooks, shapes
    analytics/ auth/ admin/ account/ settings/ seo/
  config/                 THE ONLY place that reads process.env
  db/                     schema/ + the connection
  lib/                    all real logic, grouped by domain
    auth/ drawings/ storage/ users/ tldraw/ crypto/ ui/ aws-icons/
  proxy.ts                AuthKit session refresh + matcher
  instrumentation.ts      boot-time env validation
drizzle/                  SQL migrations (generated, then renamed by hand)
docs/adr/                 decision records            ← new work starts here
docs/superpowers/         specs & plans
scripts/                  build-time generators (AWS icons, brand assets)
```

**Where does new code go?** Data access → `lib/<domain>/queries.ts`. Pure helpers →
`lib/<domain>/`. Anything reading env → `config/`. Shared UI → `components/ui/`.
Tool-specific UI → `components/tools/<tool>/`. Routes stay thin: resolve the user,
call a lib function, render or respond.

---

## 7. House style

**ESLint runs Next's defaults only and enforces none of this.** It is convention,
and it is consistent across every file — match it.

- Double quotes. **No semicolons.** Two-space indent. Trailing commas in multiline.
- **Arrow functions throughout**, including components:
  `const Thing: FunctionComponent<Props> = ({ a }) => (...)`.
- **`export default X` on the last line**, named exports grouped at the bottom:
  `export { a, b }`. Do not export inline mid-file except for Next's required
  conventions (`export const GET`, `export const metadata`, `export const dynamic`).
- **`@/*` path alias always** — never `../..`.
- Imports sorted by path; `type` imports inline (`import { type Editor, Tldraw }`).
- Props typed as `type Props = Readonly<{ ... }>` for components.
- File names kebab-case; components PascalCase.

**Comments carry the *why*, never the *what*.** This codebase's defining habit is
that every non-obvious decision has a comment explaining the reasoning, the
alternative rejected, and often the measurement behind it. Match that density.
A comment that restates the code is noise; a comment explaining why the obvious
approach was wrong is the point. When you discover something the hard way — a
browser quirk, a library constraint — write it down where the next reader will hit it.

---

## 8. Patterns you must follow

**Environment.** Nothing outside `src/config/` and `instrumentation.ts` may touch
`process.env`. `clientConfig` is browser-safe and must never receive a secret;
`serverConfig` imports `server-only`. Values are lazy getters — an eager read breaks
`next build`. New required variables go in `REQUIRED_ENV_VARS` (`config/env.ts`) and
in `.env.example`.

**Auth is a choke point, not a per-route check.** `lib/auth/current-user.ts` is the
gate:

| Function | Use for | Returns |
| --- | --- | --- |
| `requireDbUser()` | pages | approved user, else redirects |
| `getDbUser()` | route handlers | approved user or `null` → answer 401 |
| `requireAdmin()` | admin pages | admin, else redirects |
| `getAccountUser()` | **only** `/account`, `/admin/**`, reapply | any signed-in user |

`getDbUser`/`requireDbUser` return **approved users only**. Using `getAccountUser`
anywhere else is a bug. Do not add access checks in layouts — a layout guard is
theatre, since a pending user holds a valid session and can call the API directly.

**Every query is user-scoped.** Functions in `lib/*/queries.ts` take `userId` first
and filter on it. Ids travel in URLs and are not secrets. Someone else's row answers
**404, never 403** — a 403 confirms existence. The single deliberate exception is
`getDrawingByShareToken`, where the token *is* the credential; anything reading by
token must reuse that exact WHERE clause (revoked, trashed and banned-owner rows all
have to fall out together).

**Soft delete is the default.** `deletedAt IS NULL` belongs in every read. Only two
paths remove rows, and both refuse anything not already trashed.

**Server vs client.** Components are server by default. `"use client"` only for
state, effects, or browser APIs. Keep client components leaf-ward — fetch on the
server and pass data down.

**Deduping a query between metadata and page:** wrap it in React `cache()` and call
it with identical arguments from both.

**Browser-persisted state** (theme, consent) uses a module-level store plus
`useSyncExternalStore` — `subscribe*` / `get*Snapshot` / `getServer*Snapshot`. Do
not reach for `useState` + `useEffect`; it trips `react-hooks/set-state-in-effect`
and flashes on load. See `lib/ui/theme.ts` as the reference implementation.

**tldraw UI is injected, not wrapped.** Pass a module-scope `TLComponents` object
(a fresh object each render remounts every panel) mapping zones — `MenuPanel`,
`TopPanel`, `SharePanel`, `Toolbar` — to your own components or `null`. Zones are
`pointer-events-none`, so canvas chrome needs `PANEL_CLASSES` from
`components/tools/draw/floating-menu.ts`, and dropdowns need its `DROPDOWN_CLASSES`
z-index, because tldraw's own panels stack to 99999.

**Menus** reuse `useDismissableMenu` from `components/ui/menu.ts` — never hand-roll
outside-click handling.

**Tailwind v4 gotcha:** a descendant selector (`[&_p]:…`, specificity 0,1,1)
outranks an element-level utility (0,1,0). Dark mode is a class on `<html>` via
`@custom-variant dark`, not `prefers-color-scheme`.

---

## 9. Database

Schema in `src/db/schema/`, one file per table, re-exported from `index.ts`.

```bash
bun run db:generate    # writes drizzle/NNNN_*.sql from schema changes
bun run db:migrate     # applies it
```

Generated filenames get a random suffix — rename the file *and* its `tag` in
`drizzle/meta/_journal.json` to keep the directory readable. Migrations are
append-only; never edit an applied one.

RLS is enabled on every table with **no policies**, deliberately — this app reaches
Postgres directly server-side and never uses PostgREST, so an empty policy set costs
nothing and closes the tables if the anon key leaks. New tables get the same
treatment.

The database is **shared with production**. A migration applied locally is applied
everywhere; assume any destructive SQL is real.

---

## 10. Verification — there is no test suite

That is a deliberate constraint to work within, not an invitation to skip checking.

Always: `bunx tsc --noEmit` and `bun run lint`.

For anything user-visible, exercise it in a browser against `bun run dev` and report
what you saw. Prefer measuring over asserting — read computed styles, check response
codes and byte sizes, query the database to confirm a write. Several bugs in this
repo's history were found only because a claim was checked instead of assumed.

Beware: **`bun run build` writes into `.next` and kills a running dev server.** Do
not run it casually; if you must, say so afterwards.

---

## 11. Security invariants

Treat these as fixed. If a task seems to require breaking one, stop and ask.

- User-supplied cloud credentials are encrypted at rest (AES-256-GCM,
  `lib/crypto/secret-box.ts`) and **never** returned to the browser.
- `CREDENTIALS_ENCRYPTION_KEY` must stay stable and identical in production —
  changing it makes every stored credential undecryptable.
- Share tokens are bearer credentials. Never log one, never put one in a page a
  crawler can index, never let a failed lookup be distinguishable from a revoked one.
- Never leak existence: 404 over 403, identical responses for "missing" and
  "not yours".
- `NEXT_PUBLIC_*` ships to the browser. Anything secret must not be prefixed.

---

## 12. Cost discipline

Context is the budget. Spend it on the change, not on rediscovery.

- Read this file, then read only the files you are changing. Do not survey the tree
  to "get oriented" — §6 is that orientation.
- Search for a symbol rather than reading a file to find it; read a range rather
  than a whole file when you know the range.
- The README answers "why is it like this"; this file answers "how do I work here".
  Consult them before the source.
- Do not re-verify what a previous step already established in this conversation.
- When you learn something durable, add it here in one line — that is what stops
  the next task paying to learn it again.

---

## 13. Keeping this file honest

This file rots the moment the code moves ahead of it. After every task, ask whether
the change altered anything above — a new directory, a new pattern, a new invariant,
a new script, a changed version pin — and edit it in the same breath as the code.
Same for `README.md` when the *rationale* changes, and `.env.example` when
configuration does. Recording that in the ADR is not a substitute: an ADR is history,
this file is the current state.
