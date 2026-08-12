import Link from "next/link"
import { signOutAction } from "@/lib/auth/actions"
import { getCurrentUser } from "@/lib/auth/session"

const UserMenu = async () => {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <Link
        href="/auth/sign-in?returnTo=%2F"
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{user.firstName ?? user.email}</span>

      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Sign out
        </button>
      </form>
    </div>
  )
}

export default UserMenu
