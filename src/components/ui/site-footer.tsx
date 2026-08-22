import Link from "next/link"
import type { FunctionComponent } from "react"
import ToolCredits from "@/components/tools/tool-credits"
import { CONTAINER } from "@/lib/ui/layout"
import { cn } from "@/lib/utils"

/**
 * The bottom of every page: library attribution, then the legal links.
 *
 * The credits and the links are separate components because they answer to
 * different things — the credits are derived from the tool registry and grow as
 * tools are added, while these links are fixed. This file owns the `<footer>`
 * element so there is one of them however many parts end up inside.
 *
 * A full-width band with the shared container inside, so the rule above it runs
 * edge to edge like the header's does rather than stopping short at the content
 * column.
 */
const SiteFooter: FunctionComponent = () => {
  return (
    <footer className="mt-16 border-t border-border">
      <div className={cn(CONTAINER, "flex flex-wrap items-center justify-between gap-2 py-6")}>
        <ToolCredits/>

        <p className="text-xs text-muted-foreground">
          <Link href="/credits" className="underline-offset-4 hover:text-foreground hover:underline">Credits</Link>
          {" · "}
          <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">Privacy</Link>
          {" · "}
          <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">Terms</Link>
        </p>
      </div>
    </footer>
  )
}

export default SiteFooter
