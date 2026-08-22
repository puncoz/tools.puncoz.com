# 3. Add Cloudflare icons, and generalise the icon shape to carry them

- **Status:** Accepted
- **Date:** 2026-08-21

## Context

The draw tool ships AWS architecture icons and nothing else. Cloudflare is the
second provider worth drawing, and the request is explicitly for "more icons/shapes
— now for Cloudflare", so whatever is built here should make a third set cheap
rather than doubling the code again.

The AWS pipeline is shaped by its source: the `aws-icons` package contains ~300
full-colour 64×64 SVG files and *only* architecture icons, so the build script
copies every `.svg` it finds into a gitignored `public/aws-icons/` and the catalogue
includes everything. AWS's terms restrict redistribution, which is why the artwork
never enters this repository.

Cloudflare has no equivalent package. What it does have is
**`@cloudflare/component-icon`** — official, BSD-3-Clause, 13.15.3, published June
2026 — and it differs from `aws-icons` in four ways that each move the design:

1. **It is a UI kit, not an icon set for diagrams.** Of 252 exports, roughly a third
   are Cloudflare products (`R2`, `D1`, `Queues`, `Hyperdrive`, `Vectorize`,
   `WorkersKv`, `MagicFirewall`, `CloudflareZeroTrust`…). The rest is interface
   chrome (`Hamburger`, `CaretUp`, `Copy`) and other companies' marks (`Github`,
   `Discord`, `Twitter`, `Terraform`).
2. **The icons are React components, not SVG files.** There is no `.svg` in the
   package to copy.
3. **The art is 16×16 and monochrome** — one path, no `fill` declared. Rendered
   as-is it is black, and invisible on a dark canvas.
4. **There is no `exports` field, and the peer range is React ^15–17** against this
   project's React 19.

Verified before committing to any of this: deep-importing
`@cloudflare/component-icon/es/reactsvgs/<Icon>.js` and rendering with
`renderToStaticMarkup` produces correct SVG under React 19, and a `fill` prop
reaches the root `<svg>`. Those files import nothing but `react`, so the React
version range and Cloudflare's own style packages never come into play — both
problems in (4) are avoided by never importing the package root.

## Decision

**Source.** `@cloudflare/component-icon`, a direct dependency, rendered to static
SVG at build time by `scripts/build-cloudflare-icons.tsx` into a gitignored
`public/cloudflare-icons/`. This mirrors the AWS pipeline's output exactly, so
everything downstream of the artwork is shared.

**Colour.** Icons are rendered with `fill="#F6821F"`, Cloudflare's orange, baked in
at build time. Monochrome art needs a colour chosen for it; orange is legible on
both light and dark canvas, is Cloudflare's own, and makes the set read as a group
beside the multicoloured AWS tiles.

**Curation by allowlist.** `src/lib/cloudflare-icons/products.json` maps export name
to display name, and nothing outside it is built. This is the inverse of the AWS
script, deliberately: `aws-icons` contains only architecture icons so taking
everything is right there, while here taking everything would put `Hamburger` and
somebody else's logo in the picker. The build fails loudly if an allowlisted export
has disappeared upstream, which is how a package rename gets noticed.

**One shape implementation, one per-set instance.** `aws-icon-shape-util.tsx` is
~230 lines of which exactly one — the icon URL — is provider-specific. It is
extracted into a factory, `shapes/icon-shape-util.tsx`, that both sets instantiate.
The `aws-icon` **type string, props and migration sequence are unchanged**, so no
stored document migrates and no drawing is at risk. `cloudflare-icon` is a second
instance registered alongside it. The picker is generalised the same way.

## Alternatives considered

**Duplicate the shape util per provider.** Rejected: it copies two hazards that were
expensive to find and are invisible when broken — `canEdit()` requiring a `richText`
prop or the canvas crashes outright, and `toSvg` missing meaning icons vanish from
every export and thumbnail *with no error*. Two copies drift, and drift in this file
has a documented failure mode where a diagram works for its author and breaks for
everyone holding the share link.

**Add a `provider` prop to the existing `aws-icon` shape.** One shape type, no
factory. Rejected because the type string is persisted in every stored shape record:
either it stays `aws-icon` and permanently misnames Cloudflare shapes, or it changes
and existing documents fail to load. A props migration cannot rename a shape type.

**Vendor the rendered SVGs and drop the dependency.** BSD-3 permits redistribution
with the notice retained, and ~100 rendered icons is only ~100 KB against 3.9 MB and
25 packages of install. Genuinely close, and the reason it loses is narrow: an icon
source that is present at install time cannot be silently skipped. The README
already records that a missed icon step makes every icon 404 *without failing the
build*, and committed artwork plus a manual regeneration step reintroduces exactly
that class of silent staleness. Revisit if the install cost starts to matter.

**Put the dependency in `devDependencies`.** More honest — it is build-time only —
but it creates a way for a platform that prunes dev dependencies to produce that
same silent 404. `aws-icons` sits in `dependencies` for the same reason; match it.

**The community `cf-icons` set.** Built from this same package, adds only curation
and a colour, and states no licence. Nothing to gain and a licence question to
inherit.

## Consequences

A third icon set now costs a catalogue, a build script and two thin instantiations —
no new shape logic, no new picker.

Cloudflare icons look different from AWS ones: flat single-colour glyphs beside
detailed multicoloured tiles. That is inherent to the upstream art, not a choice,
and a mixed diagram will show it.

The allowlist has to be maintained by hand. New Cloudflare products will not appear
on a package bump until someone adds them — accepted deliberately, since the same
property is what keeps interface chrome out.

`@cloudflare/component-icon` pulls five unused `@cloudflare/*` transitive packages
(`style-const`, `style-container`, `intl-types`, `types`, `util-en-garde`) as peers
of a package root this project never imports. Install cost only; nothing reaches the
bundle.

Both shape utils must stay registered in `shapes/index.ts` for **both** canvases.
That file already carries the warning; it now guards two types instead of one.

## Follow-ups

- ~~Attribution for the icon set belongs beside AWS's in the tool credits.~~
  Addressed by [ADR 4](0004-attribution.md).
- If a third set is added, revisit whether `products.json` and the build scripts
  should collapse into one parameterised script rather than one per provider.
