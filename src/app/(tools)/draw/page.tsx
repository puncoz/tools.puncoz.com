import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import UserMenu from "@/components/auth/user-menu"
import DrawingGallery from "@/components/tools/draw/drawing-gallery"
import TrashGallery from "@/components/tools/draw/trash-gallery"
import { requireDbUser } from "@/lib/auth/current-user"
import { countTrashedDrawings, listDrawings, listTrashedDrawings } from "@/lib/drawings/queries"
import { relativeTime } from "@/lib/ui/relative-time"
import { cn } from "@/lib/utils"

const absolute = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })

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
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true"/>
            All tools
          </Link>

          <UserMenu/>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
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
                  showTrash ? "text-muted-foreground hover:text-foreground" : "bg-accent text-accent-foreground",
                )}
              >
                Drawings
              </Link>

              <Link
                href="/draw?view=trash"
                aria-current={showTrash ? "page" : undefined}
                className={cn(
                  tabClasses,
                  showTrash ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
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
      </main>
    </div>
  )
}

export default DrawIndexPage
