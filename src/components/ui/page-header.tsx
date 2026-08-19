import Link from "next/link"
import { Fragment, type FunctionComponent, type ReactNode } from "react"
import Logo from "@/components/ui/logo"
import ThemeToggle from "@/components/ui/theme-toggle"
import { CONTAINER } from "@/lib/ui/layout"
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

type Props = Readonly<{
  /**
   * Where you are, appended after "tools": `["Draw", "Trash"]` reads
   * `puncoz / tools / Draw / Trash`.
   *
   * Plain text, not links. The last one repeats the page's own `<h1>`, and the
   * intermediate ones have no route of their own to point at.
   */
  crumbs?: string[]
  /** The right-hand cluster — usually `<UserMenu/>`. */
  children?: ReactNode
}>

/**
 * One separator, drawn once and reused, so the spacing either side of every
 * slash is identical. The wordmark used to carry its own "/tools" while the
 * header drew the rest, which put two different slashes on one line.
 */
const Separator: FunctionComponent = () => (
  <span aria-hidden="true" className="select-none text-border">/</span>
)

const PageHeader: FunctionComponent<Props> = ({ crumbs = [], children }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className={cn(CONTAINER, "flex items-center justify-between gap-4 py-3")}>
        {/* `leading-none` on the row and the crumbs: the wordmark is an image
            with no baseline, so line-height on the text beside it is what makes
            the two look a pixel or two out of true. */}
        <div className="flex min-w-0 items-center gap-2 text-sm leading-none">
          <Logo/>

          <Separator/>

          {/* Home, like the wordmark. Two targets for one destination is the
              deliberate call: the wordmark is a picture and not everyone reads
              it as a button, so the word beside it carries the same link. */}
          <Link
            href="/"
            className="rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            tools
          </Link>

          {crumbs.map((crumb, index) => (
            <Fragment key={crumb}>
              <Separator/>

              <span
                className={cn(
                  "truncate",
                  index === crumbs.length - 1 ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {crumb}
              </span>
            </Fragment>
          ))}
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
