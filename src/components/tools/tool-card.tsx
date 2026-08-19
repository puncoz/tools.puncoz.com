import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import type { FunctionComponent } from "react"
import { CATEGORY_LABELS, type Tool } from "@/lib/tools"
import { cn } from "@/lib/utils"

type Props = Readonly<{
  tool: Tool
}>

const cardClasses = "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-5 text-left transition-all"

const ToolCard: FunctionComponent<Props> = ({ tool }) => {
  const Icon = tool.icon
  const isSoon = tool.status === "soon"

  const body = (
    <>
      {/* Brand wash that fades in on hover. Behind the content, and inert. */}
      {!isSoon && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-brand/0 blur-2xl transition-colors duration-300 group-hover:bg-brand/20"
        />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-xl transition-colors",
            // Solid brand rather than a tint: at 20px a tinted glyph reads as
            // grey and the card loses its only colour. An icon is a graphic, so
            // the 3:1 threshold applies and white on #567F95 (4.32:1) clears it
            // — which is not true of the label-bearing variants.
            isSoon
              ? "bg-muted text-muted-foreground"
              : "bg-brand text-brand-foreground group-hover:bg-primary",
          )}
        >
          <Icon className="size-5" aria-hidden="true"/>
        </span>

        {isSoon
          ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Soon
            </span>
          )
          : (
            <ArrowUpRight
              className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          )}
      </div>

      <h3 className="relative mt-4 font-semibold text-card-foreground">{tool.name}</h3>

      <p className="relative mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
        {tool.description}
      </p>

      <span className="relative mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
        {CATEGORY_LABELS[tool.category]}
      </span>
    </>
  )

  // Unbuilt tools are deliberately not links: a dead end that looks clickable is
  // worse than one that plainly is not.
  if (isSoon) {
    return (
      <div className={cn(cardClasses, "opacity-60")} aria-disabled="true">
        {body}
      </div>
    )
  }

  return (
    <Link
      href={tool.href}
      className={cn(
        cardClasses,
        "hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {body}
    </Link>
  )
}

export default ToolCard
