import type { Metadata } from "next"
import Link from "next/link"
import DrawingGallery from "@/components/tools/draw/drawing-gallery"
import TrashGallery from "@/components/tools/draw/trash-gallery"
import PageShell from "@/components/ui/page-shell"
import { requireDbUser } from "@/lib/auth/current-user"
import { countTrashedDrawings, listDrawings, listTrashedDrawings } from "@/lib/drawings/queries"
import { toolBySlug } from "@/lib/tools"
import { relativeTime } from "@/lib/ui/relative-time"
import { cn } from "@/lib/utils"

const absolute = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })

/**
 * Described from the tool registry, so the meta description and the landing
 * page's card for this tool cannot drift apart.
 *
 * `noindex` because the page is a list of one person's private drawings. It is
 * behind a session and a crawler would only ever be redirected to sign in, but
 * saying so costs nothing and does not depend on that redirect staying in place.
 */
export const metadata: Metadata = {
  title: "Draw",
  description: toolBySlug("draw")?.description,
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ view?: string }>
}

const tabClasses = "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/**
 * The drawing gallery, and the trash behind the same route.
 *
 * A search param rather than a `/draw/trash` segment: that path would sit beside
 * `/draw/[id]` and only stay unambiguous for as long as every drawing id is a
 * uuid, which is not a property worth depending on.
 *
 * Timestamps are formatted here rather than in the client components: comparing
 * the server's clock at render time against the browser's at hydration time is a
 * hydration mismatch waiting to happen.
 */
const DrawIndexPage = async ({ searchParams }: Props) => {
  const showTrash = (await searchParams).view === "trash"
  const user = await requireDbUser()
  const now = new Date()

  // Only ever one list: the gallery pays for a count, not for the trash itself.
  const drawings = showTrash ? [] : await listDrawings(user.id)
  const trashed = showTrash ? await listTrashedDrawings(user.id) : []
  const trashedCount = showTrash ? trashed.length : await countTrashedDrawings(user.id)

  return (
    <PageShell crumbs={showTrash ? ["Draw", "Trash"] : ["Draw"]}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {showTrash ? "Trash" : "Drawings"}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {showTrash
                ? "Deleted drawings, kept until you remove them."
                : drawings.length === 0
                  ? "Everything you draw is saved to your account."
                  : `${drawings.length} ${drawings.length === 1 ? "drawing" : "drawings"}, saved to your account.`}
            </p>
          </div>

          {/* Hidden entirely when there is nothing in the trash and you are not
              already looking at it — an empty bin is not worth a tab. */}
          {(trashedCount > 0 || showTrash) && (
            <div className="flex rounded-lg border border-border p-0.5">
              <Link
                href="/draw"
                aria-current={showTrash ? undefined : "page"}
                className={cn(
                  tabClasses,
                  showTrash ? "text-muted-foreground hover:text-foreground" : "bg-brand-subtle text-brand",
                )}
              >
                Drawings
              </Link>

              <Link
                href="/draw?view=trash"
                aria-current={showTrash ? "page" : undefined}
                className={cn(
                  tabClasses,
                  showTrash ? "bg-brand-subtle text-brand" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Trash {trashedCount > 0 && `(${trashedCount})`}
              </Link>
            </div>
          )}
        </div>

        <div className="mt-8">
          {showTrash
            ? (
              <TrashGallery
                drawings={trashed.map(drawing => ({
                  id: drawing.id,
                  title: drawing.title,
                  deletedLabel: `Deleted ${relativeTime(drawing.deletedAt, now)}`,
                  deletedAbsolute: absolute.format(drawing.deletedAt),
                  thumbnailVersion: drawing.thumbnailUpdatedAt?.toISOString() ?? null,
                }))}
              />
            )
            : (
              <DrawingGallery
                drawings={drawings.map(drawing => ({
                  id: drawing.id,
                  title: drawing.title,
                  updatedAt: drawing.updatedAt.toISOString(),
                  updatedLabel: `Edited ${relativeTime(drawing.updatedAt, now)}`,
                  updatedAbsolute: absolute.format(drawing.updatedAt),
                  thumbnailVersion: drawing.thumbnailUpdatedAt?.toISOString() ?? null,
                  isShared: drawing.isShared,
                }))}
              />
            )}
        </div>
    </PageShell>
  )
}

export default DrawIndexPage
