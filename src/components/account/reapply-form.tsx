"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FunctionComponent, useState } from "react"
import { withProgress } from "@/lib/ui/progress"

type Props = Readonly<{
  /** Preformatted on the server, so the two clocks cannot disagree. */
  availableAtLabel: string | null
}>

const ReapplyForm: FunctionComponent<Props> = ({ availableAtLabel }) => {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (availableAtLabel) {
    return (
      <p className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        You asked for another review recently. You can ask again after{" "}
        <span className="font-medium text-foreground">{availableAtLabel}</span>.
      </p>
    )
  }

  const submit = async () => {
    const text = message.trim()

    if (text.length === 0) {
      setError("Please add a short message.")

      return
    }

    setBusy(true)
    setError(null)

    try {
      await withProgress(async () => {
        const response = await fetch("/api/account/reapply", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text }),
        })

        if (!response.ok) {
          throw new Error(
            response.status === 429
              ? "You have asked for a review too recently."
              : "That did not work. Please try again.",
          )
        }

        router.refresh()
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="mt-4"
      onSubmit={event => {
        event.preventDefault()
        void submit()
      }}
    >
      <label htmlFor="reapply-message" className="text-sm font-medium">
        Ask for another review
      </label>

      <p className="mt-1 text-sm text-muted-foreground">
        Tell me a little about who you are and what you would use this for.
      </p>

      <textarea
        id="reapply-message"
        rows={4}
        value={message}
        onChange={event => setMessage(event.target.value)}
        maxLength={1000}
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true"/>}
        Send for review
      </button>
    </form>
  )
}

export default ReapplyForm
