"use client"

import { Loader2, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FunctionComponent, useState } from "react"
import { inputClasses } from "@/components/ui/input"
import { withProgress } from "@/lib/ui/progress"

/**
 * Pre-approves someone who has never signed in.
 *
 * The row this creates has no WorkOS identity; their first Google sign-in claims
 * it by email and they land straight in, already approved.
 */
const InviteUserForm: FunctionComponent = () => {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)

    try {
      await withProgress(async () => {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        })

        if (!response.ok) {
          const { error: code } = await response.json().catch(() => ({ error: "" })) as { error?: string }

          throw new Error(
            code === "already_exists"
              ? "That address already has an account — use the actions on their row."
              : code === "invalid_email"
                ? "That does not look like an email address."
                : "That did not work.",
          )
        }

        setEmail("")
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
      className="flex flex-wrap items-start gap-2"
      onSubmit={event => {
        event.preventDefault()
        void submit()
      }}
    >
      <div>
        <label htmlFor="invite-email" className="sr-only">Email to pre-approve</label>

        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="name@example.com"
          className={inputClasses("w-64 bg-card")}
        />

        {error && <p className="mt-1.5 max-w-64 text-xs text-destructive">{error}</p>}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy
          ? <Loader2 className="size-4 animate-spin" aria-hidden="true"/>
          : <UserPlus className="size-4" aria-hidden="true"/>}
        Pre-approve
      </button>
    </form>
  )
}

export default InviteUserForm
