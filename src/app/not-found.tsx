import Link from "next/link"
import type { FunctionComponent } from "react"
import { buttonClasses } from "@/components/ui/button"
import PageShell from "@/components/ui/page-shell"

/**
 * The 404, in the same shell as everything else.
 *
 * Reached by a typo, by a revoked share link, and by any drawing id that is not
 * yours — `getDrawing` answers 404 rather than 403 so ids cannot be probed. The
 * wording therefore has to cover "gone" and "never yours" without hinting which,
 * since saying "you do not have access" would leak that the drawing exists.
 *
 * The shell's header covers the signed-out case on its own — someone who
 * followed a dead share link gets a sign-in button rather than an avatar.
 */
const NotFoundPage: FunctionComponent = () => {
  return (
    <PageShell crumbs={["Not found"]}>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        This page does not exist
      </h1>

      <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
        The link may be wrong, or it may point at something that has been deleted or is not
        shared with you.
      </p>

      <Link href="/" className={buttonClasses({ variant: "primary", className: "mt-6" })}>
        Back to the tools
      </Link>
    </PageShell>
  )
}

export default NotFoundPage
