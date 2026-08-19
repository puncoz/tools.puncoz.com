import { cn } from "@/lib/utils"

/**
 * One definition of what a text field looks like.
 *
 * The focus treatment is a brand-tinted halo plus a brand border rather than the
 * default two-pixel ring: on a form with several fields stacked, a ring reads as
 * a box drawn around the input, while the halo reads as the field itself waking
 * up. It also stays legible on the dark palette, where a hard ring against a
 * dark border almost disappears.
 *
 * A class function rather than a component because these sit on `<input>`,
 * `<textarea>` and `<select>` alike, and wrapping three elements to vary one
 * string is not worth the indirection.
 */
const inputClasses = (className?: string): string =>
  cn(
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors",
    "placeholder:text-muted-foreground",
    "focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )

export { inputClasses }
