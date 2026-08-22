import type { FunctionComponent, ReactNode } from "react"
import UserMenu from "@/components/auth/user-menu"
import PageHeader from "@/components/ui/page-header"
import SiteFooter from "@/components/ui/site-footer"
import { CONTAINER } from "@/lib/ui/layout"
import { cn } from "@/lib/utils"

/**
 * Every page that is a page.
 *
 * Header, content column and footer in one place, so a new page cannot end up
 * with a different width, a missing footer or its own idea of vertical rhythm —
 * which is exactly how the gallery, admin, settings, account and the legal
 * documents drifted apart from each other and from the landing page.
 *
 * The two canvases — `/draw/[id]` and `/s/[token]` — deliberately do not use
 * this. They are full-bleed surfaces where tldraw owns every pixel and supplies
 * its own chrome; wrapping them would put a header above a canvas that is
 * `position: fixed` underneath it.
 *
 * `flex-1` on the content plus `min-h-screen` on the column is what keeps the
 * footer at the bottom of a short page instead of floating under the heading.
 */

type Props = Readonly<{
  /** Breadcrumbs after "tools" — see `PageHeader`. */
  crumbs?: string[]
  /** Extra classes for the `<main>`, for the rare page that needs to narrow. */
  className?: string
  children: ReactNode
}>

const PageShell: FunctionComponent<Props> = ({ crumbs, className, children }) => {
  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader crumbs={crumbs}>
        {/* Rendered here rather than passed in per page: a sign-in button that
            exists on five pages out of nine is exactly the scattered header this
            replaced. The cost is that reading the session makes every page
            dynamic — including the two legal documents, which used to
            prerender, and which are therefore rendered per request and sent
            with Next's own `no-store` for a dynamic render. (That last clause
            used to credit the `no-store` to AuthKit's proxy; it is Next's —
            see ADR 0008.) */}
        <UserMenu/>
      </PageHeader>

      <main className={cn(CONTAINER, "flex-1 py-10 sm:py-14", className)}>
        {children}
      </main>

      <SiteFooter/>
    </div>
  )
}

export default PageShell
