import Image from "next/image"
import Link from "next/link"
import type { FunctionComponent } from "react"
import mark from "@/assets/img/logo-icon-light.png"
import wordmarkDark from "@/assets/img/wordmark-dark.png"
import wordmark from "@/assets/img/wordmark.png"
import { clientConfig } from "@/config/client"
import { cn } from "@/lib/utils"

/**
 * The brand lockup.
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
 * The icon uses the light asset in both themes on purpose. It is a filled brand
 * disc, which reads on white and on the dark slate alike; the dark variant is a
 * bare blue glyph that measures 2.6:1 on the dark background and disappears.
 */

type Props = Readonly<{
  /** Renders as a link home unless this is false — the landing page is home. */
  asLink?: boolean
  className?: string
}>

const Wordmark: FunctionComponent<{ className?: string }> = ({ className }) => (
  <span className={cn("inline-flex items-center gap-2", className)}>
    <Image
      src={wordmark}
      alt={clientConfig.app.name}
      priority
      className="h-8 w-auto dark:hidden"
    />

    <Image
      src={wordmarkDark}
      alt=""
      aria-hidden="true"
      priority
      className="hidden h-8 w-auto dark:block"
    />

    <span className="text-sm font-medium text-muted-foreground">/tools</span>
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

/** Icon only, for the places a wordmark will not fit — canvas chrome, avatars. */
const LogoMark: FunctionComponent<{ className?: string }> = ({ className }) => (
  <Image
    src={mark}
    alt=""
    aria-hidden="true"
    className={cn("size-6 rounded-full", className)}
  />
)

export default Logo
export { LogoMark }
