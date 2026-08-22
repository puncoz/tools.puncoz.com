import type { Metadata } from "next"
import Link from "next/link"
import { cache, type FunctionComponent, Suspense } from "react"
import DrawingGallery from "@/components/tools/draw/drawing-gallery"
import GallerySkeleton from "@/components/tools/draw/gallery-skeleton"
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
 * Everything this page needs from the database, behind one `cache()`.
 *
 * Three regions below stream independently — the count line, the trash tabs and
 * the gallery — and each awaits this. `cache()` is what makes that one set of
 * queries rather than three, and it is the same pattern `AGENTS.md` §8
 * prescribes for deduping between metadata and page. Both call sites must pass
 * the identical pair of primitives, which is why `showTrash` is a boolean
 * argument rather than something read from `searchParams` in here.
 *
 * Only ever one list: the gallery pays for a count, not for the trash itself.
 * The two independent queries are issued together rather than awaited one after
 * the other — serialising them costs a second round trip (ADR 0005).
 */
const loadGallery = cache(async (userId: string, showTrash: boolean) => {
  if (showTrash) {
    const trashed = await listTrashedDrawings(userId)

    return { drawings: [], trashed, trashedCount: trashed.length }
  }

  const [drawings, trashedCount] = await Promise.all([
    listDrawings(userId),
    countTrashedDrawings(userId),
  ])

  return { drawings, trashed: [], trashedCount }
})

type SectionProps = Readonly<{
  userId: string
  showTrash: boolean
}>

/** The count line under the heading. Streamed because it needs the list length. */
const GalleryDescription: FunctionComponent<SectionProps> = async ({ userId, showTrash }) => {
  const { drawings } = await loadGallery(userId, showTrash)

  return (
    <p className="mt-2 text-sm text-muted-foreground">
      {showTrash
        ? "Deleted drawings, kept until you remove them."
        : drawings.length === 0
          ? "Everything you draw is saved to your account."
          : `${drawings.length} ${drawings.length === 1 ? "drawing" : "drawings"}, saved to your account.`}
    </p>
  )
}

/**
 * Hidden entirely when there is nothing in the trash and you are not already
 * looking at it — an empty bin is not worth a tab. That conditional is why this
 * region's Suspense fallback is `null` rather than a placeholder: the tabs
 * already appear or not depending on data, so arriving late is the behaviour
 * this page always had.
 */
const TrashTabs: FunctionComponent<SectionProps> = async ({ userId, showTrash }) => {
  const { trashedCount } = await loadGallery(userId, showTrash)

  if (trashedCount === 0 && !showTrash) {
    return null
  }

  return (
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
  )
}

/**
 * Timestamps are formatted here rather than in the client components: comparing
 * the server's clock at render time against the browser's at hydration time is a
 * hydration mismatch waiting to happen.
 */
const Gallery: FunctionComponent<SectionProps> = async ({ userId, showTrash }) => {
  const { drawings, trashed } = await loadGallery(userId, showTrash)
  const now = new Date()

  if (showTrash) {
    return (
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
  }

  return (
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
  )
}

/**
 * The drawing gallery, and the trash behind the same route.
 *
 * A search param rather than a `/draw/trash` segment: that path would sit beside
 * `/draw/[id]` and only stay unambiguous for as long as every drawing id is a
 * uuid, which is not a property worth depending on.
 *
 * The shell — header, heading, footer — renders without touching the database,
 * and the three data-dependent regions stream in behind `<Suspense>`. This page
 * had the site's worst TTFB at 2.79s, none of it query cost: the response was
 * simply held open until the identity lookup and then the drawing list had both
 * come back. See ADR 0010.
 *
 * `requireDbUser()` stays *outside* every boundary on purpose. It redirects an
 * unapproved user to `/account`, and a redirect cannot be issued once the shell
 * has been flushed — streaming it would turn a clean redirect into a flash of a
 * page they may not use. A future change that streams more of this page must
 * leave this where it is.
 */
const DrawIndexPage = async ({ searchParams }: Props) => {
  const showTrash = (await searchParams).view === "trash"
  const user = await requireDbUser()
  const section = { userId: user.id, showTrash }

  return (
    <PageShell crumbs={showTrash ? ["Draw", "Trash"] : ["Draw"]}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {showTrash ? "Trash" : "Drawings"}
          </h1>

          <Suspense fallback={<div className="mt-2 h-5 w-56 animate-pulse rounded bg-muted"/>}>
            <GalleryDescription {...section}/>
          </Suspense>
        </div>

        <Suspense fallback={null}>
          <TrashTabs {...section}/>
        </Suspense>
      </div>

      <div className="mt-8">
        <Suspense fallback={<GallerySkeleton/>}>
          <Gallery {...section}/>
        </Suspense>
      </div>
    </PageShell>
  )
}

export default DrawIndexPage
