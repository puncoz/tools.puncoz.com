import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import UserMenu from "@/components/auth/user-menu"
import DrawingGallery from "@/components/tools/draw/drawing-gallery"
import { requireDbUser } from "@/lib/auth/current-user"
import { listDrawings } from "@/lib/drawings/queries"
import { relativeTime } from "@/lib/ui/relative-time"

const absolute = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" })

/**
 * The drawing gallery.
 *
 * Timestamps are formatted here rather than in the client component: comparing
 * the server's clock at render time against the browser's at hydration time is a
 * hydration mismatch waiting to happen.
 */
const DrawIndexPage = async () => {
  const user = await requireDbUser()
  const drawings = await listDrawings(user.id)
  const now = new Date()

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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Drawings</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {drawings.length === 0
            ? "Everything you draw is saved to your account."
            : `${drawings.length} ${drawings.length === 1 ? "drawing" : "drawings"}, saved to your account.`}
        </p>

        <div className="mt-8">
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
        </div>
      </main>
    </div>
  )
}

export default DrawIndexPage
