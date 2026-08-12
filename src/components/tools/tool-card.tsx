import Link from "next/link"
import type { FunctionComponent } from "react"
import { CATEGORY_LABELS, type Tool } from "@/lib/tools"
import { cn } from "@/lib/utils"

type Props = Readonly<{
  tool: Tool
}>

const cardClasses = "group relative flex h-full flex-col rounded-xl border border-border bg-card p-5 text-left transition-colors"

const ToolCard: FunctionComponent<Props> = ({ tool }) => {
  const Icon = tool.icon
  const isSoon = tool.status === "soon"

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors",
            !isSoon && "group-hover:border-primary/30 group-hover:text-foreground",
          )}
        >
          <Icon className="size-5" aria-hidden="true"/>
        </span>

        {isSoon && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Soon
          </span>
        )}
      </div>

      <h3 className="mt-4 font-semibold text-card-foreground">{tool.name}</h3>

      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">
        {tool.description}
      </p>

      <span className="mt-4 text-xs text-muted-foreground/70">
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
        "hover:border-primary/40 hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {body}
    </Link>
  )
}

export default ToolCard
