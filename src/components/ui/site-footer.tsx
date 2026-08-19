import Link from "next/link"
import type { FunctionComponent } from "react"
import ToolCredits from "@/components/tools/tool-credits"

/**
 * The bottom of the landing page: library attribution, then the legal links.
 *
 * The two are separate components because they answer to different things — the
 * credits are derived from the tool registry and grow as tools are added, while
 * these links are fixed. This file owns the `<footer>` element so there is one
 * of them however many parts end up inside.
 */
const SiteFooter: FunctionComponent = () => {
  return (
    <footer className="mt-14 space-y-2 border-t border-border pt-6">
      <ToolCredits/>

      <p className="text-xs text-muted-foreground">
        <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy</Link>
        {" · "}
        <Link href="/terms" className="underline-offset-4 hover:underline">Terms</Link>
      </p>
    </footer>
  )
}

export default SiteFooter
