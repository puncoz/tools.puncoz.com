# 2. Give the shared canvas its own viewer controls

- **Status:** Accepted
- **Date:** 2026-08-20

> Recorded after the fact. This change was implemented before [ADR 1](0001-record-architecture-decisions.md)
> established the ADR-first rule, and is written up here so the decision is not
> lost. It is the exception, not the pattern.

## Context

`/s/[token]` renders a drawing read-only by clearing every tldraw UI zone —
`MenuPanel`, `TopPanel`, `SharePanel` and the rest set to `null`. Read-only mode
already hides most editing chrome, and emptying the zones outright means there is
nothing to click even if a future tldraw release changes what read-only suppresses.

Two things were lost with it.

A tldraw document holds many pages, and imported ones routinely do: the drawing this
came from has **13**, of which one is empty. tldraw only renders its `PageMenu`
inside `DefaultMenuPanel`, so clearing that zone made every page after the first
unreachable behind a share link. The editor is unaffected — `home-button.tsx`
renders `DefaultMenuPanel` alongside its own controls, so tldraw's page menu is still
there, verified by opening the 13-page drawing.

The share view also had no theme control. It is full-bleed canvas with no site
header, and it is frequently the only page of this site a visitor ever sees.

## Decision

The share view keeps two controls, neither of which can edit anything:

- **`TopPanel`** — a custom `PageSwitcher` (`components/tools/draw/page-switcher.tsx`),
  which renders nothing at all when the document has fewer than two pages.
- **`SharePanel`** — the same `ThemeMenu` the editor uses, with the same
  `PANEL_CLASSES` surface and `z-[100000]`.

Switching pages calls `setCurrentPage` then `zoomToFit`, because tldraw keeps a
camera per page and imported content rarely sits near the origin.

## Alternatives considered

**Un-null tldraw's own `PageMenu`.** Free, and consistent with the editor. Rejected
on two counts: its read-only mode still renders "Create new page" and the per-page
submenu, merely disabled, which is dead chrome on a link handed to a stranger; and
it lives in the top-left zone, which the share page already occupies with the title
and "Read-only" badge.

**Put the page switcher in the top-left with the badge.** Same collision. Centring
it in `TopPanel` mirrors where the editor puts its drawing switcher.

**Leave the theme to the visitor's OS.** Rejected because a diagram drawn in one
mode is not always legible in the other, and there is no header on this page to
carry the control.

## Consequences

Page **names** are now visible to anyone holding a share link. In the drawing that
prompted this they read like project names (`jobins-architecture`, `alata.ai
ideation`). This is inherent to the feature and worth knowing: sharing a multi-page
drawing now discloses its table of contents.

The theme choice is written to the visitor's `localStorage` under the same key the
rest of the site uses, so choosing Light on a share link sets their preference for
the whole site. Consistent with the header, and intended.

Single-page drawings are visually unchanged — the switcher does not render at all.

No new plumbing was needed for the theme: `use-canvas-theme.ts` already watches the
`dark` class on `<html>`, so tldraw's colour mode followed.

## Follow-ups

- The Open Graph card and the gallery thumbnail still render only the document's
  **first** page, so a 13-page drawing under-represents itself in a link preview.
- The share page's title badge truncates at `50vw` and shares the `z-[100000]` layer
  with these dropdowns. Nothing overlaps at present, but a long title on a narrow
  window is the one case that could reach the centred switcher.
