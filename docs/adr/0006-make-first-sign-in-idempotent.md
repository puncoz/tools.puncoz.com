# 0006. Make first sign-in idempotent with an upsert

- **Status:** Accepted
- **Date:** 2026-08-22

## Context

`syncUser` resolves a WorkOS user to its local row by reading, then writing:

```
select by workos_id  →  select by email  →  update if found, else insert
```

Between that last read and the insert there is a window, and two renders of the
same request can both be inside it. The `(tools)` layout and the page within it both
call `requireDbUser()`, and a client-side navigation issues further RSC requests —
[ADR 0005](0005-colocate-functions-with-the-database.md) measured **five** identity
lookups for one navigation. On a brand-new account every one of those misses, so more
than one can reach the insert.

Reproduced against the real schema, inside a rolled-back transaction:

```
(a) today's behaviour — plain insert on a racing duplicate:
      plain insert FAILED code=23505 constraint=users_workos_id_unique
```

The consequence is not cosmetic. The very first thing a new account does is fail, and
`syncUser` is reached from `requireDbUser()` — so the user's first page load errors,
on the one code path that exists to make sure a signed-in account can own drawings.

Note *which* constraint fired: `users_workos_id_unique`, not the email index. Postgres
reaches the `workos_id` index first on this table, which matters for choosing the fix,
because `ON CONFLICT` takes a single arbiter index and the racing pair violates both.

The `cache()` added in ADR 0005 narrows the window but cannot close it: a miss is
cached as a miss, so concurrent first-time renders still both proceed to write.

## Decision

The final insert becomes an upsert arbitrated on `email`:

```
insert … on conflict (email) do update set workos_id = excluded.workos_id, …
```

`email` is the right arbiter because it is the invariant the schema already states —
`users_email_unique` is commented as load-bearing for invites, "find the row with this
email" only being sound if at most one row can hold it. The upsert makes the race
resolve into exactly that lookup.

Verified empirically rather than assumed, since the racing insert violates *both*
unique indexes and only one can be the arbiter:

```
upsert with a simultaneous workos_id collision:  SUCCEEDED
invite hand-off (row with null workos_id):       claimed, 1 row — not duplicated
```

It holds because `ON CONFLICT` tests the arbiter index *before* the speculative
insert, so the email conflict is found and the update path taken without ever
inserting into the `workos_id` index.

The conflict branch sets the profile columns and claims `workos_id`, and for an admin
address also sets `access_status`. It deliberately does **not** write
`access_reviewed_at`: reaching this branch means the row already existed and already
has its own review history.

## Alternatives considered

**Catch the unique violation and retry the lookup.** Correct regardless of which
constraint fires, and tempting for that reason. Rejected because it needs a retry
bound and a driver-specific error-code check to avoid swallowing unrelated failures,
and it turns the common path into read–write–fail–read. The upsert is one statement
and one round trip, which the previous ADR makes the thing worth optimising for.

**Arbitrate on `workos_id` instead.** It is the index that actually fires first today,
so it looks like the natural target. Rejected: it is nullable, and Postgres treats
nulls as distinct, so an invite row — the entire reason the column is nullable — would
not conflict and would be duplicated instead of claimed.

**A unique constraint spanning both columns.** Does not describe the invariant. The
rule is one row per email; `workos_id` uniqueness is a separate guard against two rows
claiming one identity. A composite would permit exactly what must not happen.

**Serialise it with an advisory lock.** Closes the window, at the cost of a lock round
trip on every sign-in to prevent a collision that occurs once per account, ever.

**Leave it.** It only bites on the first render of a new account. Rejected because
that is the *worst* moment to fail: the account exists at the identity provider, the
session is valid, and the local row that everything else keys off does not appear.

## Consequences

- First sign-in stops depending on timing. Whichever render arrives second updates the
  row the first created rather than failing.
- The invite hand-off is unchanged and now atomic: claiming an invite row is the same
  statement as creating a new one.
- One statement instead of a conditional insert, so the write path is also one round
  trip shorter — worth something given the database is a region away from the
  function.
- Not closed, and accepted: if the address at WorkOS changes between one racer's read
  and another's write, the insert can still collide on `workos_id` with no arbiter for
  it. That requires an email change landing inside a few milliseconds of a first
  sign-in, and it is a different bug from this one.
- The two `select`s before the write are now belt-and-braces rather than load-bearing.
  They are kept because they carry the invite resolution order and the admin
  force-approval, which the conflict branch does not reproduce in full.

## Follow-ups

Nothing outstanding.
