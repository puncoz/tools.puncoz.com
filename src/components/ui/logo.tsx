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
 */

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
      className="h-7 w-auto dark:hidden"
    />

    <Image
      src={wordmarkDark}
      alt=""
      aria-hidden="true"
      priority
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
