import type { FunctionComponent } from "react"

/**
 * How many cards count as "the first row", and therefore get the priority hint.
 *
 * Four, because the grid is `xl:grid-cols-4` at its widest — so this is one row
 * on a large screen and the first two on a laptop. Narrower breakpoints show
 * fewer columns and so hint a card or two below the fold, which is the harmless
 * direction to be wrong in: it reorders requests that were going to be made
 * anyway. Must stay in step with the grid in `drawing-gallery.tsx` and
 * `trash-gallery.tsx`.
 */
const FIRST_ROW = 4

type Props = Readonly<{
  drawingId: string
  title: string
  /** Doubles as "has a preview" and as the cache buster on the preview URL. */
  thumbnailVersion: string | null
  /**
   * Set by the gallery for the first row only — those cards are above the fold
   * and one of them is the page's LCP element, so they are moved up the request
   * queue ahead of the ones below.
   *
   * A priority hint and *not* `loading="eager"`, which is the obvious move and
   * is wrong here: see the note below on why both variants stay lazy.
   */
  priority?: boolean
}>

/**
 * A drawing's gallery preview, or its initial when it has none.
 *
 * Shared by the gallery and the trash so a card looks the same in both — picking
 * the right drawing back out of the trash is a visual job, and a grid of
 * placeholder letters would make it guesswork.
 *
 * Two images, one per theme, hidden by CSS rather than chosen in JavaScript. The
 * theme class is on `<html>` before first paint, so this swaps with no hydration
 * pass and no flash of a light thumbnail on a dark page — the same approach the
 * wordmark uses.
 *
 * The hidden one costs nothing: `loading="lazy"` on a `display: none` image is
 * never fetched (measured — an eager hidden image *is*), so a gallery still
 * downloads exactly one image per card and the other arrives only if the theme
 * is switched.
 *
 * That property is why the first row gets `fetchPriority="high"` and keeps
 * `loading="lazy"`, rather than the `eager` that would seem to belong there.
 * Nothing on the server knows which variant the theme class will reveal, so
 * `eager` would have to go on both — and an eager hidden image is fetched,
 * which would double every above-the-fold request to buy back the little that
 * lazy costs on a card that is already in the viewport. The hint reorders the
 * queue without changing what is in it. `logo.tsx` has the same shape of
 * problem and pays the double fetch, because `priority` there implies eager;
 * it is affordable only because those two images are now ~4KB (ADR 0008).
 *
 * CORRECTION (ADR 0008): this file and the route behind it both used to state
 * that AuthKit's proxy overwrites the response's `Cache-Control` with
 * `no-store`, so previews could never be cached and every gallery visit
 * refetched. Measured against production, that is no longer true — the route's
 * `private, max-age=31536000, immutable` arrives intact, and `authkit-nextjs@4`
 * only sets `cache-control` when it is itself setting a cookie. Repeat visits
 * are served from the browser's disk cache. The first visit still pays a
 * function invocation per card (~2s for ~9KB, almost all of it invocation and a
 * database read), which is what the eager first row above is for.
 */
const DrawingPreview: FunctionComponent<Props> = ({ drawingId, title, thumbnailVersion, priority = false }) => {
  if (thumbnailVersion === null) {
    return (
      <div className="flex size-full items-center justify-center bg-muted">
        <span className="text-3xl font-semibold text-muted-foreground/50">
          {(title.trim()[0] ?? "?").toUpperCase()}
        </span>
      </div>
    )
  }

  const src = (theme: "light" | "dark") =>
    `/api/drawings/${drawingId}/thumbnail?v=${encodeURIComponent(thumbnailVersion)}`
    + (theme === "dark" ? "&theme=dark" : "")

  return (
    <>
      {/* Plain <img>s: the route is private and authenticated by cookie, so the
          Next image optimizer — which refetches server-side without them — would
          only ever get a 401. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src("light")}
        alt=""
        loading="lazy"
        fetchPriority={priority ? "high" : undefined}
        className="size-full bg-white object-contain dark:hidden"
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src("dark")}
        alt=""
        loading="lazy"
        fetchPriority={priority ? "high" : undefined}
        className="hidden size-full bg-card object-contain dark:block"
      />
    </>
  )
}

export { FIRST_ROW }
export default DrawingPreview
