"use client"

import { Check, ChevronDown, FilePlus2, Pencil } from "lucide-react"
import type { FunctionComponent } from "react"
import { DROPDOWN_CLASSES, PANEL_CLASSES, useDismissableMenu } from "@/components/tools/draw/floating-menu"
import { cn } from "@/lib/utils"

/**
 * The project pill, rendered into tldraw's `TopPanel` zone so it floats over
 * the canvas without taking layout space.
 *
 * Rename/New are present but disabled: multiple drawings are not implemented
 * yet. Showing them disabled — rather than hiding them — is what makes this the
 * seam for that work. When drawings land, `DRAFT_PROJECT_NAME` becomes the
 * active drawing's name and these become real actions.
 */
const DRAFT_PROJECT_NAME = "Untitled"

type SoonItemProps = Readonly<{
  icon: typeof Pencil
  label: string
}>

const SoonItem: FunctionComponent<SoonItemProps> = ({ icon: Icon, label }) => (
  <span
    aria-disabled="true"
    className="flex cursor-not-allowed items-center gap-2 px-3 py-2 text-sm text-muted-foreground/60"
  >
    <Icon className="size-3.5" aria-hidden="true"/>
    {label}
    <span className="ml-auto rounded-full border border-border px-1.5 text-[10px] uppercase tracking-wide">
      Soon
    </span>
  </span>
)

const ProjectMenu: FunctionComponent = () => {
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(PANEL_CLASSES, "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent")}
      >
        {DRAFT_PROJECT_NAME}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true"/>
      </button>

      {open && (
        <div role="menu" className={cn(DROPDOWN_CLASSES, "left-1/2 w-52 -translate-x-1/2")}>
          <span role="menuitem" className="flex items-center gap-2 px-3 py-2 text-sm">
            <Check className="size-3.5" aria-hidden="true"/>
            {DRAFT_PROJECT_NAME}
          </span>

          <div className="my-1 h-px bg-border"/>

          <SoonItem icon={Pencil} label="Rename"/>
          <SoonItem icon={FilePlus2} label="New drawing"/>
        </div>
      )}
    </div>
  )
}

export default ProjectMenu
