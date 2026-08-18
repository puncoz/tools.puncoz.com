# User access approval — design

Date: 2026-08-16
Status: approved

## Problem

WorkOS authenticates anyone with a Google account, and authentication is
currently the whole of authorisation: sign in and every tool is yours. The site
is personal, so access needs to be granted deliberately rather than assumed.

## Goal

A reviewed access lifecycle. Anyone may sign in; nobody reaches a tool until the
owner approves them. The owner can approve, decline (with a reason), ban, and
invite people by email before they have ever signed in.

## Decisions

| Question | Choice |
| --- | --- |
| Pre-approving an unseen email | Invite rows in `users`, linked by email at first sign-in |
| Share links of non-approved owners | Banned kills links; declined and pending keep them |
| Declined users | Unlimited reapplies on a cooldown |
| Admin action history | Full event log |

## Non-goals

- Email notification on approval or decline. No mail provider is configured and
  adding one is its own project; pending users surface as a badge in the admin
  header instead.
- Roles or teams. There is one admin, identified by environment variable, and
  everyone else is a user.
- Rate limiting beyond the reapply cooldown.

## Data model

### `users`

| Column | Purpose |
| --- | --- |
| `access_status` | `pending` \| `approved` \| `declined` \| `banned`, default `pending` |
| `access_note` | The most recent admin note, shown to the user |
| `access_reviewed_at` | When the current status was set |
| `access_reviewed_by` | The admin's user id; null for system transitions |
| `last_reapplied_at` | Drives the reapply cooldown |

Two structural changes follow from the invite decision:

- **`workos_id` becomes nullable.** An invite row has no WorkOS identity until
  the invited person first signs in. It stays unique; Postgres treats nulls as
  distinct, so any number of outstanding invites coexist.
- **`email` gains a unique index and is normalised to lowercase on write.**
  Invite matching is "find the row with this email", which is only sound if at
  most one row can hold it. Without this the feature has a silent failure mode
  where an invite matches an arbitrary row.

### `user_access_events`

`user_id`, `from_status`, `to_status`, `note`, `actor_id`, `source`
(`admin` | `self` | `system`), `created_at`.

Current status stays denormalised on the user row so the hot path — which runs
on *every* authenticated request — remains a single indexed read. The event log
is only read by the admin screen.

### Migration `0008`

Adds the columns and the table, and **grandfathers every existing user to
`approved`**. Without that line, deploying this locks the owner out of an account
that already holds imported drawings. The new table gets RLS enabled with no
policies, matching every other table.

## Where enforcement lives

`getDbUser` is called from 14 places across 8 API route files; `requireDbUser`
from 3 pages. Gating the `(tools)` layout would be theatre: a pending user holds
a valid session and can call `/api/drawings` directly.

So **`getDbUser` and `requireDbUser` keep their names and begin returning only
approved users.** Every existing call site becomes safe with no edit, and every
future one is safe by default. Reaching a non-approved user requires the
explicitly-named `getAccountUser()`, used only by `/account` and `/admin`.

This mirrors the rule already governing `src/lib/drawings/queries.ts`: safe by
default, exceptions named and commented rather than left to a reviewer's memory.

- `requireDbUser` redirects a non-approved user to `/account`.
- `getDbUser` returns null, so route handlers answer 401 exactly as they do for
  an absent session. A pending user and a signed-out one are indistinguishable
  to an API client, which is the correct amount of information to leak.

The three routes that must serve non-approved users — `/account`,
`/admin/**` and `POST /api/account/reapply` — use `getAccountUser()` instead, and
each says why in a comment. That is the complete list; anything else reaching for
it is a bug.

## Admin identity

`ADMIN_EMAILS`, comma-separated, in `serverConfig`, added to `REQUIRED_ENV_VARS`
so a misconfiguration fails at boot rather than silently leaving nobody able to
approve anyone.

**There is deliberately no admin flag in the database.** Admin is derived from
environment alone, so it cannot be granted by writing a row — the escalation path
that a boolean column would create does not exist.

Two consequences, both intentional:

- An account whose email is in the list is force-approved at sign-in whatever its
  stored status, so the owner cannot lock themselves out.
- An admin cannot change their own status. No accidental self-ban.

## Sign-in flow

`syncUser` resolves in order:

1. Match on `workos_id` — the returning-user path. Refresh profile fields.
2. Match on lowercased `email` — the invite hand-off. Attach `workos_id` to the
   existing row and keep its status, which is how a pre-approved invite becomes a
   working account on first sign-in.
3. Insert a new row as `pending`, or `approved` if the email is an admin.

## Screens

### `/account`

The post-sign-in destination for anyone not approved. Outside the `(tools)`
group, so it is not subject to the approval guard it exists to explain.

- **pending** — the request is being reviewed.
- **declined** — the admin's note, and a reapply form. Unlimited reapplies on a
  **7-day cooldown**; when inside the cooldown the form is replaced by the date
  they may next apply. Reapplying returns the user to `pending` and records the
  message as a `self`-sourced event. The cooldown is measured from
  `last_reapplied_at`, which is null until the first reapply — so a freshly
  declined user may reapply immediately, and the wait applies only between
  successive attempts.
- **banned** — the ban notice and note. No reapply.
- **approved** — redirected to `/`; the page has nothing to say to them.

### `/admin/users`

Admin only, guarded on the page *and* on every route handler behind it.

A table of every user: avatar, name, email, status, joined, last sign-in, latest
note. Actions: approve, decline with an optional note, ban, reset to pending. An
"add user by email" form creates the pre-approved invite row. Status filter,
pending first, with a pending count badge.

Every transition writes a `user_access_events` row.

### `/`

Stays public. A signed-in but non-approved visitor sees a status strip linking to
`/account` rather than a grid of tools that would bounce them.

## Share links

`getDrawingByShareToken` joins `users` and excludes **banned** owners only.
Declined and pending owners' links keep working.

Ban is the punitive state and should actually take content offline; declined
means "not admitted", which is not a reason to break links already handed out.
Pending users cannot have created links anyway, having never had tool access.

## Files

New:

- `drizzle/0008_add_user_access.sql`
- `src/db/schema/user-access-events.ts`
- `src/lib/auth/access.ts` — status type, admin check, cooldown policy
- `src/lib/users/queries.ts` — list, invite, transition, reapply
- `src/app/account/page.tsx` and its components
- `src/app/admin/users/page.tsx` and its components
- `src/app/api/admin/users/route.ts` — create invite
- `src/app/api/admin/users/[id]/access/route.ts` — transition
- `src/app/api/account/reapply/route.ts`

Changed:

- `src/db/schema/users.ts`, `src/db/schema/index.ts`
- `src/config/env.ts`, `src/config/server.ts`, `.env.example`
- `src/lib/auth/current-user.ts` — enforcement, `getAccountUser`, `requireAdmin`
- `src/lib/auth/sync-user.ts` — email matching and invite linking
- `src/lib/drawings/queries.ts` — banned owners excluded from share lookup
- `src/app/page.tsx` — status strip

## Verification

Static: typecheck, lint, build.

Behavioural, in the browser and against the database:

1. Existing users are `approved` after migrating and still reach their drawings.
2. A pending user is refused by **both** a page and a direct API call — the
   latter is the check that matters, since it is the one a layout guard misses.
3. An invite created by email links to the account on first sign-in and lands
   approved.
4. Approve, decline, ban and reset each move the user and write an event.
5. Reapply works once, then the cooldown blocks it, and the server refuses a
   reapply from a non-declined user regardless of what the UI shows.
6. A banned owner's share link 404s; a declined owner's still resolves.
7. An admin cannot change their own status.
8. A non-admin reaches neither `/admin` nor its API routes.
