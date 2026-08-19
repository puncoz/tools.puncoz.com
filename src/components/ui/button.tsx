import type { ButtonHTMLAttributes, FunctionComponent } from "react"
import { cn } from "@/lib/utils"

/**
 * One definition of what a button looks like.
 *
 * Before this, eight files each declared their own `linkClasses` /
 * `buttonClasses` / `menuItemClasses` with slightly different padding, radius
 * and hover colours — which is why the app never quite looked like one app.
 *
 * A plain record rather than `class-variance-authority`: two axes and six
 * variants do not justify a dependency, and `cn` already merges conflicts.
 *
 * Exported as a class function rather than only a component because most call
 * sites are `<Link>` or a form's submit button, not a bare `<button>`.
 */

type Variant = "primary" | "outline" | "ghost" | "destructive" | "brand"

type Size = "sm" | "md" | "icon"

const BASE = "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"

/**
 * `primary` is the darker step of the brand, not `--brand` itself: it is the one
 * variant with white text sitting on the colour, and #567F95 under white is
 * 4.32:1 — short of AA. See the palette note in `main.css`.
 */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-border bg-transparent hover:border-brand/40 hover:bg-accent hover:text-accent-foreground",
  ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  destructive: "border border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10",
  brand: "bg-brand-subtle text-brand hover:bg-brand/15",
}

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-1.5 text-sm",
  icon: "size-8 p-0",
}

type ButtonStyle = {
  variant?: Variant
  size?: Size
  className?: string
}

const buttonClasses = ({ variant = "outline", size = "md", className }: ButtonStyle = {}): string =>
  cn(BASE, VARIANTS[variant], SIZES[size], className)

type Props = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle

const Button: FunctionComponent<Props> = ({ variant, size, className, type = "button", ...rest }) => (
  <button type={type} className={buttonClasses({ variant, size, className })} {...rest}/>
)

export default Button
export { buttonClasses }
export type { Size, Variant }
