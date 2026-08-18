import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { signOutAction } from "@/lib/auth/actions"
import { getAccountUser, isAdmin } from "@/lib/auth/current-user"

const linkClasses = "rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"

const UserMenu = async () => {
  // Rendered on pages that unapproved users can reach, so it reads the account
  // row rather than the approved-only helper.
  const user = await getAccountUser()

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

      {isAdmin(user) && (
        <Link href="/admin/users" className={`${linkClasses} inline-flex items-center gap-1.5`}>
          <ShieldCheck className="size-3.5" aria-hidden="true"/>
          People
        </Link>
      )}

      <Link href="/settings/storage" className={linkClasses}>
        Settings
      </Link>

      <form action={signOutAction}>
        <button type="submit" className={linkClasses}>
          Sign out
        </button>
      </form>
    </div>
  )
}

export default UserMenu
