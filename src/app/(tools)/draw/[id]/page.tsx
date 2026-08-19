import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cache } from "react"
import DrawCanvas from "@/components/tools/draw-canvas"
import { getDbUser, requireDbUser } from "@/lib/auth/current-user"
import { getDrawing, touchDrawing } from "@/lib/drawings/queries"

type Props = {
  params: Promise<{ id: string }>
}

/**
 * One read per request, shared by `generateMetadata` and the page.
 *
 * Next calls both, and without `cache` the drawing — document and all, which is
 * the largest column in the schema — would be loaded twice to render one canvas.
 * React dedupes on the arguments, so both call sites must pass the same pair.
 */
const loadDrawing = cache(async (userId: string, id: string) =>
  getDrawing(userId, id))

/**
 * The drawing's own name in the tab, so a window full of canvases is navigable.
 *
 * Reads through `getDbUser` rather than `requireDbUser`: the latter redirects,
 * and a redirect thrown from metadata generation is a confusing way to handle a
 * signed-out visitor when the page below is about to do it properly.
 *
 * A drawing that does not exist and one owned by somebody else produce the same
 * "Not found" — which is the same rule `getDrawing` follows by answering 404
 * rather than 403. Only your own drawings are ever named, so the tab cannot be
 * used as an oracle for which ids exist.
 *
 * With no session the title stays "Draw": the page below redirects to sign-in
 * rather than 404ing, and announcing "Not found" for a drawing that is merely
 * unauthenticated would be wrong on the one path where the reader can fix it.
 */
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { id } = await params
  const user = await getDbUser()

  if (!user) {
    return { title: "Draw", robots: { index: false, follow: false } }
  }

  const drawing = await loadDrawing(user.id, id)

  return {
    title: drawing?.title ?? "Not found",
    robots: { index: false, follow: false },
  }
}

const DrawPage = async ({ params }: Props) => {
  const { id } = await params
  const user = await requireDbUser()
  const drawing = await loadDrawing(user.id, id)

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
        // Drives the one-off backfill: drawings that predate previews
        // entirely, and drawings whose preview was rendered before there was a
        // dark variant to go with it.
        needsThumbnail: drawing.thumbnailUpdatedAt === null || !drawing.hasDarkThumbnail,
        // The button's state before the popover is opened. The token itself is
        // fetched on demand and never sent to the client here.
        isShared: drawing.shareToken !== null,
      }}
    />
  )
}

export default DrawPage
