import Image from "next/image"
import Link from "next/link"
import type { FunctionComponent } from "react"
import wordmarkDark from "@/assets/img/wordmark-dark.png"
import wordmark from "@/assets/img/wordmark.png"
import { clientConfig } from "@/config/client"
import { cn } from "@/lib/utils"

/**
 * The wordmark, and only the wordmark.
 *
 * It is the first crumb of the header's breadcrumb rather than a self-contained
 * lockup, so it deliberately does not carry "/tools" — that belongs to the trail
 * in `page-header.tsx`, where every separator is drawn the same way and spaced
 * the same. Baking one slash in here and letting the header draw the rest gave
 * two different treatments on one line.
 *
 * `wordmark.png` / `wordmark-dark.png` are `logo.png` / `logo-dark.png` with
 * their transparent padding cropped off — the originals carry roughly 250px of
 * empty pixels, which at header size reads as the logo being small and sitting
 * too high. The uncropped files are left in place untouched.
 *
 * Both variants are rendered and one is hidden by CSS rather than picking in
 * JavaScript: the theme class is on `<html>` before paint, so this swaps with no
 * hydration pass and no flash of the wrong logo.
 *
 * `priority` stays on both despite one being hidden, and that is deliberate:
 * which variant is painted is decided by the theme class before first paint, so
 * demoting either would risk a logo-shaped hole for half the users. It is only
 * affordable because the sources are now 256px — see ADR 0008, where these were
 * measured at 266KB the pair, preloaded ahead of the CSS on every route.
 */

/**
 * The box the wordmark is painted into — `h-7 w-auto` on a 256x112 source is
 * 64x28. Without this, a static import makes `next/image` size the srcSet
 * against the viewport rather than the element, and it picks the largest
 * candidate it has. Must stay in step with the `h-7` below.
 */
const DISPLAY_WIDTH = "64px"

type Props = Readonly<{
  /** Renders as a link home unless this is false — the landing page is home. */
  asLink?: boolean
  className?: string
}>

const Wordmark: FunctionComponent<{ className?: string }> = ({ className }) => (
  <span className={cn("inline-flex items-center", className)}>
    <Image
      src={wordmark}
      alt={clientConfig.app.name}
      priority
      sizes={DISPLAY_WIDTH}
      className="h-7 w-auto dark:hidden"
    />

    <Image
      src={wordmarkDark}
      alt=""
      aria-hidden="true"
      priority
      sizes={DISPLAY_WIDTH}
      className="hidden h-7 w-auto dark:block"
    />
  </span>
)

const Logo: FunctionComponent<Props> = ({ asLink = true, className }) => {
  if (!asLink) {
    return <Wordmark className={className}/>
  }

  return (
    <Link
      href="/"
      aria-label={`${clientConfig.app.name} home`}
      className={cn(
        "rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Wordmark/>
    </Link>
  )
}

export default Logo
