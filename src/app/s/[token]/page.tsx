import type { Metadata } from "next"
import { notFound } from "next/navigation"
import SharedCanvas from "@/components/tools/draw/shared-canvas"
import { getDrawingByShareToken } from "@/lib/drawings/queries"
import { isShareTokenShaped } from "@/lib/drawings/share"

type Props = {
  params: Promise<{ token: string }>
}

/**
 * `noindex` even though `robots.ts` disallows `/s/` and `next.config.ts` sends an
 * `X-Robots-Tag` — three independent layers, because a share link that reaches a
 * search index is not something a revoke can undo.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Reads a live row and must reflect a revoke immediately.
export const dynamic = "force-dynamic"

/**
 * A drawing behind a share link.
 *
 * Deliberately outside the `(tools)` route group, so it never reaches that
 * layout's `requireAuth()` guard. AuthKit's proxy still runs, but with no
 * `middlewareAuth` configured it only refreshes an existing session — a
 * signed-out visitor passes straight through.
 *
 * Shows the title and nothing else about the owner: no email, no account menu, no
 * route to their other drawings.
 */
const SharedDrawingPage = async ({ params }: Props) => {
  const { token } = await params

  // An unknown, revoked or malformed token is the same 404 as a typo.
  if (!isShareTokenShaped(token)) {
    notFound()
  }

  const drawing = await getDrawingByShareToken(token)

  if (!drawing) {
    notFound()
  }

  return (
    <>
      <SharedCanvas token={token} document={drawing.document}/>

      <div className="pointer-events-none fixed left-3 top-3 z-[100000] flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-card-foreground shadow-sm">
        <span className="max-w-[50vw] truncate text-sm font-medium">{drawing.title}</span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          Read-only
        </span>
      </div>
    </>
  )
}

export default SharedDrawingPage
