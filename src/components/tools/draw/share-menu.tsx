"use client"

import { Share2 } from "lucide-react"
import { type FunctionComponent, useState } from "react"
import { useDrawing } from "@/components/tools/draw/drawing-context"
import { DROPDOWN_CLASSES, PANEL_CLASSES, useDismissableMenu } from "@/components/tools/draw/floating-menu"
import ShareControls from "@/components/tools/draw/share-controls"
import { cn } from "@/lib/utils"

/**
 * Share button for tldraw's top-right zone.
 *
 * The controls mount only while the popover is open, which is also when the token
 * is fetched — a drawing that is never shared never asks for one.
 */
const ShareMenu: FunctionComponent = () => {
  const drawing = useDrawing()
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()
  const [isShared, setIsShared] = useState(drawing.isShared)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={isShared ? "Sharing: on" : "Share"}
        title={isShared ? "Sharing: anyone with the link can view" : "Share"}
        className={cn(
          PANEL_CLASSES,
          "flex size-9 items-center justify-center transition-colors hover:bg-accent",
          isShared && "text-foreground",
        )}
      >
        <Share2 className={cn("size-4", !isShared && "text-muted-foreground")} aria-hidden="true"/>
      </button>

      {open && (
        <div className={cn(DROPDOWN_CLASSES, "right-0 w-72 p-1")}>
          <ShareControls drawingId={drawing.id} onSharedChange={setIsShared}/>
        </div>
      )}
    </div>
  )
}

export default ShareMenu
