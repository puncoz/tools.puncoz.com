import type { FunctionComponent, ReactNode } from "react"
import Logo from "@/components/ui/logo"
import ThemeToggle from "@/components/ui/theme-toggle"
import { cn } from "@/lib/utils"

/**
 * The bar at the top of every page that is not a full-bleed canvas.
 *
 * Six pages each grew their own version of this, with three different content
 * widths and two different treatments of the home link. Centralising it is what
 * makes the wordmark appear everywhere for free — and what stops the next page
 * from inventing a seventh.
 *
 * The theme toggle lives here rather than in the user menu so it is reachable on
 * the pages that have no menu: the legal documents, which a signed-out visitor
 * reads.
 */

const WIDTHS = {
  narrow: "max-w-3xl",
  wide: "max-w-5xl",
  full: "max-w-6xl",
} as const

type Props = Readonly<{
  /** Matches the width of the `<main>` below it, so the two line up. */
  width?: keyof typeof WIDTHS
  /**
   * Where you are, as a breadcrumb after the wordmark. Not a link — the
   * wordmark beside it already goes home, and two adjacent controls pointing at
   * the same place is one more thing to aim at for no gain.
   */
  section?: string
  /** The right-hand cluster — usually `<UserMenu/>`. */
  children?: ReactNode
}>

const PageHeader: FunctionComponent<Props> = ({ width = "wide", section, children }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className={cn("mx-auto flex items-center justify-between gap-4 px-6 py-3", WIDTHS[width])}>
        <div className="flex min-w-0 items-center gap-2">
          <Logo/>

          {section && (
            <>
              <span className="text-border" aria-hidden="true">/</span>

              <span className="truncate text-sm text-muted-foreground">{section}</span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {children}

          <ThemeToggle/>
        </div>
      </div>
    </header>
  )
}

export default PageHeader
