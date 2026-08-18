"use client"

import { Check, Loader2, RotateCcw, ShieldBan, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FunctionComponent, useState } from "react"
import type { AccessStatus } from "@/db/schema"
import { withProgress } from "@/lib/ui/progress"
import { cn } from "@/lib/utils"

type Props = Readonly<{
  userId: string
  status: AccessStatus
  /** True for the signed-in admin's own row, whose actions are disabled. */
  isSelf: boolean
}>

const buttonClasses = "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40"

/**
 * Approve / decline / ban / reset for one user.
 *
 * Decline and ban open a note field first: the note is what the user reads on
 * their account page, and a decision with no explanation is the one you regret
 * having to reconstruct later.
 */
const UserRowActions: FunctionComponent<Props> = ({ userId, status, isSelf }) => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [noteFor, setNoteFor] = useState<AccessStatus | null>(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const apply = async (next: AccessStatus, withNote?: string) => {
    setBusy(true)
    setError(null)

    try {
      await withProgress(async () => {
        const response = await fetch(`/api/admin/users/${userId}/access`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next, note: withNote ?? null }),
        })

        if (!response.ok) {
          throw new Error(
            response.status === 409
              ? "You cannot change your own access."
              : "That did not work.",
          )
        }

        setNoteFor(null)
        setNote("")
        router.refresh()
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.")
    } finally {
      setBusy(false)
    }
  }

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">Your account</span>
  }

  if (noteFor) {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={event => {
          event.preventDefault()
          void apply(noteFor, note.trim() || undefined)
        }}
      >
        <input
          autoFocus
          value={note}
          onChange={event => setNote(event.target.value)}
          placeholder={noteFor === "banned" ? "Reason for ban (optional)" : "Reason (optional)"}
          maxLength={1000}
          className="w-56 rounded-md border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <div className="flex gap-1.5">
          <button type="submit" disabled={busy} className={cn(buttonClasses, "border-destructive/40 text-destructive")}>
            {busy && <Loader2 className="size-3 animate-spin" aria-hidden="true"/>}
            Confirm {noteFor === "banned" ? "ban" : "decline"}
          </button>

          <button type="button" onClick={() => setNoteFor(null)} className={buttonClasses}>
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status !== "approved" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void apply("approved")}
          className={cn(buttonClasses, "hover:bg-accent")}
        >
          <Check className="size-3" aria-hidden="true"/>
          Approve
        </button>
      )}

      {status !== "declined" && status !== "banned" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setNoteFor("declined")}
          className={cn(buttonClasses, "hover:bg-accent")}
        >
          <X className="size-3" aria-hidden="true"/>
          Decline
        </button>
      )}

      {status !== "banned" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setNoteFor("banned")}
          className={cn(buttonClasses, "border-destructive/40 text-destructive hover:bg-destructive/10")}
        >
          <ShieldBan className="size-3" aria-hidden="true"/>
          Ban
        </button>
      )}

      {status !== "pending" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void apply("pending")}
          title="Return to pending review"
          className={cn(buttonClasses, "hover:bg-accent")}
        >
          <RotateCcw className="size-3" aria-hidden="true"/>
          Reset
        </button>
      )}

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

export default UserRowActions
