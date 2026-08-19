import { LogOut, Settings, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { buttonClasses } from "@/components/ui/button"
import type { DbUser } from "@/db/schema"
import { signOutAction } from "@/lib/auth/actions"
import { getAccountUser, isAdmin } from "@/lib/auth/current-user"

/**
 * Initials rather than `profilePictureUrl`.
 *
 * The picture is a remote URL on a WorkOS/Google host, which `next/image` will
 * not load without adding those hosts to `remotePatterns` — a config change that
 * has to be revisited every time an identity provider changes CDN. Initials are
 * self-contained and never 404.
 */
const initials = (user: DbUser): string => {
  // flatMap rather than filter+map so the nullable names narrow to defined.
  const fromName = [user.firstName, user.lastName]
    .flatMap(part => part ? [part.charAt(0)] : [])
    .join("")

  return (fromName || user.email.charAt(0)).toUpperCase().slice(0, 2)
}

const UserMenu = async () => {
  // Rendered on pages that unapproved users can reach, so it reads the account
  // row rather than the approved-only helper.
  const user = await getAccountUser()

  if (!user) {
    return (
      <Link href="/auth/sign-in?returnTo=%2F" className={buttonClasses({ variant: "primary" })}>
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span
        title={user.email}
        className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand sm:flex"
      >
        {initials(user)}
      </span>

      {isAdmin(user) && (
        <Link
          href="/admin/users"
          title="People"
          className={buttonClasses({ variant: "ghost", size: "icon" })}
        >
          <ShieldCheck className="size-4" aria-hidden="true"/>
          <span className="sr-only">People</span>
        </Link>
      )}

      <Link
        href="/settings/storage"
        title="Settings"
        className={buttonClasses({ variant: "ghost", size: "icon" })}
      >
        <Settings className="size-4" aria-hidden="true"/>
        <span className="sr-only">Settings</span>
      </Link>

      <form action={signOutAction}>
        <button
          type="submit"
          title="Sign out"
          className={buttonClasses({ variant: "ghost", size: "icon" })}
        >
          <LogOut className="size-4" aria-hidden="true"/>
          <span className="sr-only">Sign out</span>
        </button>
      </form>
    </div>
  )
}

export default UserMenu
