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

  return (
    // A plain <img>: the route is private and authenticated by cookie, so the
    // Next image optimizer — which refetches server-side without them — would
    // only ever get a 401.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/drawings/${drawingId}/thumbnail?v=${encodeURIComponent(thumbnailVersion)}`}
      alt=""
      loading="lazy"
      className="size-full bg-white object-contain"
    />
  )
}

export default DrawingPreview
