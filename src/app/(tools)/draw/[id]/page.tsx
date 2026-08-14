import { notFound } from "next/navigation"
import DrawCanvas from "@/components/tools/draw-canvas"
import { requireDbUser } from "@/lib/auth/current-user"
import { getDrawing, touchDrawing } from "@/lib/drawings/queries"

type Props = {
  params: Promise<{ id: string }>
}

const DrawPage = async ({ params }: Props) => {
  const { id } = await params
  const user = await requireDbUser()
  const drawing = await getDrawing(user.id, id)

  // A drawing owned by someone else is indistinguishable from one that does not
  // exist, so ids cannot be probed.
  if (!drawing) {
    notFound()
  }

  await touchDrawing(user.id, drawing.id)

  return (
    <DrawCanvas
      // Forces a fresh store when switching drawings; without it the previous
      // document would linger and be autosaved over the new one.
      key={drawing.id}
      drawing={{
        id: drawing.id,
        title: drawing.title,
        document: drawing.document,
        // Drives the one-off backfill for drawings that predate previews.
        hasThumbnail: drawing.thumbnailUpdatedAt !== null,
      }}
    />
  )
}

export default DrawPage
