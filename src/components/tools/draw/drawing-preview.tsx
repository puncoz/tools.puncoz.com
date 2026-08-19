import type { FunctionComponent } from "react"

type Props = Readonly<{
  drawingId: string
  title: string
  /** Doubles as "has a preview" and as the cache buster on the preview URL. */
  thumbnailVersion: string | null
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
 * is switched. That matters because these responses cannot be cached: AuthKit's
 * proxy stamps `no-store` on everything it touches, so every gallery visit
 * refetches, and a naive both-at-once would have doubled the traffic.
 */
const DrawingPreview: FunctionComponent<Props> = ({ drawingId, title, thumbnailVersion }) => {
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
        className="size-full bg-white object-contain dark:hidden"
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src("dark")}
        alt=""
        loading="lazy"
        className="hidden size-full bg-card object-contain dark:block"
      />
    </>
  )
}

export default DrawingPreview
