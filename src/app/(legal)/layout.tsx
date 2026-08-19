import Link from "next/link"
import React, { type FunctionComponent } from "react"
import PageHeader from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

type Props = Readonly<{
  children: React.ReactNode
}>

/**
 * The shell the privacy policy and terms share.
 *
 * Nothing here reads the session, and that is the point: these are the only two
 * pages that must render for a signed-out visitor — a privacy policy you have
 * to sign in to read is not one. Living outside the `(tools)` group is what
 * keeps them clear of `requireDbUser()`; the proxy still covers them, but it
 * only refreshes the session cookie and gates nothing.
 *
 * They are also the app's only static pages. Everything else renders per-user
 * and is marked `force-dynamic`; these have no per-user state at all.
 */

/**
 * Typography for both documents.
 *
 * Descendant variants rather than classes on every element: the pages are
 * mostly prose, and tagging several dozen paragraphs by hand would bury the
 * words under markup. `@tailwindcss/typography` would do the same job, but a
 * plugin is a lot of surface area to add for two pages.
 */
const prose = cn(
  "[&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
  "[&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_p]:mt-4 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground",
  "[&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5",
  "[&_li]:list-disc [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-muted-foreground",
  "[&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary",
  "[&_strong]:font-medium [&_strong]:text-foreground",
)

const LegalLayout: FunctionComponent<Props> = ({ children }) => {
  return (
    <div className="min-h-screen">
      <PageHeader width="narrow"/>

      <main className={cn("mx-auto max-w-3xl px-6 py-12 sm:py-16", prose)}>
        {children}
      </main>

      <footer className="mx-auto max-w-3xl px-6 pb-12">
        <p className="border-t border-border pt-6 text-xs text-muted-foreground">
          <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">Privacy</Link>
          {" · "}
          <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">Terms</Link>
          {" · "}
          <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">All tools</Link>
        </p>
      </footer>
    </div>
  )
}

export default LegalLayout
