import { LogOut } from "lucide-react"
import Link from "next/link"
import AccountMenu from "@/components/auth/account-menu"
import { buttonClasses } from "@/components/ui/button"
import { MENU_ITEM } from "@/components/ui/menu"
import { signOutAction } from "@/lib/auth/actions"
import { getAccountUser, isAdmin } from "@/lib/auth/current-user"

/**
 * The header's account control: a sign-in button, or the avatar menu.
 *
 * Stays a server component because both things it needs are server-only — the
 * session, and the `ADMIN_EMAILS` check behind `isAdmin` — and hands the result
 * to the client component that owns the open/close state.
 *
 * Sign-out is passed down as markup rather than a callback so it stays a real
 * `<form>` posting to a server action, which keeps working if the JavaScript
 * that powers the menu ever fails to load.
 */
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

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ")

  return (
    <AccountMenu
      user={{
        email: user.email,
        name: name || null,
        avatarUrl: user.profilePictureUrl,
      }}
      isAdmin={isAdmin(user)}
      signOut={(
        <form action={signOutAction}>
          <button type="submit" role="menuitem" className={MENU_ITEM}>
            <LogOut className="size-3.5" aria-hidden="true"/>
            Sign out
          </button>
        </form>
      )}
    />
  )
}

export default UserMenu
