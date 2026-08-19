import { cn } from "@/lib/utils"

/**
 * Long-form typography, for the two legal documents.
 *
 * Descendant variants rather than classes on every element: those pages are
 * mostly prose, and tagging several dozen paragraphs by hand would bury the
 * words under markup. `@tailwindcss/typography` would do the same job, but a
 * plugin is a lot of surface area to add for two pages.
 *
 * Note for anyone styling inside one: these are descendant selectors, so they
 * outrank a utility class put directly on a `<p>` or `<h2>`. Wrap the element or
 * change the rule here — a `mt-2` on the element itself will be ignored.
 *
 * The measure is capped well inside the shared container: a paragraph run the
 * full width of that frame is around 130 characters, roughly twice a readable
 * line. Capped but *not* centred — centring it would inset the heading from the
 * wordmark directly above it, and every other page starts hard against the
 * container's left edge.
 */
const prose = cn(
  "max-w-[68ch]",
  "[&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
  "[&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_p]:mt-4 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground",
  "[&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5",
  "[&_li]:list-disc [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-muted-foreground",
  "[&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary",
  "[&_strong]:font-medium [&_strong]:text-foreground",
)

export { prose }
