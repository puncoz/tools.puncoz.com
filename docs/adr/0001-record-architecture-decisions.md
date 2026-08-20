# 1. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-08-20

## Context

This project is built almost entirely through an AI coding assistant, and the
reasoning behind a change has been living in three places: inline comments, the
README's "Notable design decisions", and the conversation that produced the change.
Only the first two survive. The conversation — where the alternatives were weighed
and rejected — is lost as soon as the session ends.

That loss is expensive here specifically. An assistant starting a fresh session has
no memory of why the obvious approach was not taken, so it re-derives the reasoning,
or worse, re-implements the rejected option. The README records *what* the design is
but not what it was chosen over, and inline comments cannot carry a decision that
spans several files.

`docs/superpowers/specs/` already holds feature designs, but a spec describes a
system, not a choice, and specs exist only for large features. Most changes are
smaller than a spec and larger than a comment.

## Decision

Every change to this repository begins with an Architecture Decision Record in
`docs/adr/`, written **before** implementation, following the template in
`docs/adr/0000-template.md`.

Records are numbered sequentially and are append-only. A decision that no longer
holds is not edited: a new ADR supersedes it, and the old one gains a pointer
forward. Changes with no decision in them — a typo, a copy edit — are exempt, and
saying so is preferable to manufacturing a record.

ADRs sit alongside the existing `docs/superpowers/` artefacts rather than replacing
them. The ADR captures the decision; the spec captures the design; the plan captures
the sequencing.

## Alternatives considered

**Keep using the README's "Notable design decisions" section.** It is already good
and already read. But it is a single growing document with no notion of supersession
— when a decision reverses, the old reasoning is deleted, which is exactly the
history worth keeping. It also has no place for rejected alternatives without
doubling in length.

**Rely on commit messages.** They are per-change and chronological, which is most of
what is wanted. But the author commits manually and squashes as a review step, so
message granularity is not under the assistant's control; and a decision spanning a
review cycle has no single commit to attach to.

**Write a spec for everything.** Specs are the right artefact for a feature and far
too heavy for "use `overflow-x` on `html` only". The ceremony would be skipped in
practice, which is worse than a lighter artefact that is actually written.

## Consequences

Every task grows a small fixed cost: one short document before the work starts. In
exchange, a future session can read `docs/adr/` and know not just the shape of the
system but the shape of the arguments — which is the part that is expensive to
reconstruct and easy to get wrong.

The directory will accumulate records that are no longer true. That is intended;
`Superseded by` makes it navigable, and a wrong-but-explained past decision is more
useful than a silent one.

`AGENTS.md` §3 carries the operating rule, so the requirement is loaded into context
at the start of every session rather than depending on anyone remembering it.
