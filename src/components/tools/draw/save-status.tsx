"use client"

import { AlertTriangle, Check, Loader2 } from "lucide-react"
import type { FunctionComponent } from "react"
import { useDrawing } from "@/components/tools/draw/drawing-context"
import { cn } from "@/lib/utils"

/**
 * Save feedback. Silent while idle — the only states worth a user's attention
 * are "in progress" and "something went wrong".
 */
const SaveStatus: FunctionComponent = () => {
  const { saveState } = useDrawing()

  if (saveState.status === "idle") {
    return null
  }

  if (saveState.status === "error") {
    return (
      <span
        role="status"
        title={saveState.message}
        className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive"
      >
        <AlertTriangle className="size-3.5" aria-hidden="true"/>
        Not saved
      </span>
    )
  }

  const saving = saveState.status === "saving"

  return (
    <span
      role="status"
      className={cn(
        "pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground transition-opacity",
        saving ? "opacity-100" : "opacity-70",
      )}
    >
      {saving
        ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true"/>
        : <Check className="size-3.5" aria-hidden="true"/>}
      {saving ? "Saving" : "Saved"}
    </span>
  )
}

export default SaveStatus
