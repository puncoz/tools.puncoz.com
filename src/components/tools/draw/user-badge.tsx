"use client"

import { useAuth } from "@workos-inc/authkit-nextjs/components"
import { LogOut } from "lucide-react"
import type { FunctionComponent } from "react"
import AccountMenu from "@/components/auth/account-menu"
import { MENU_ITEM } from "@/components/ui/menu"

/**
 * Rendered into tldraw's `SharePanel` zone (top-right): who you are, and a way
 * to sign out without leaving the canvas.
 *
 * The same `AccountMenu` the site header uses, so the two stop drifting apart.
 * Two differences, both forced by where this runs:
 *
 * - It reads the session through AuthKit's client context rather than props.
 *   tldraw instantiates these components itself and gives no way to pass data
 *   in, so a server component cannot hand anything down.
 * - No People link. Admin status is a server-side check against `ADMIN_EMAILS`
 *   and is not derivable here. Admins reach it from any page's header.
 */
const UserBadge: FunctionComponent = () => {
  const { user, loading, signOut } = useAuth()

  if (loading || !user) {
    return null
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ")

  return (
    <AccountMenu
      user={{
        email: user.email,
        name: name || null,
        avatarUrl: user.profilePictureUrl,
      }}
      // tldraw's zones are pointer-events-none so the canvas underneath stays
      // drawable; anything interactive has to opt back in.
      className="pointer-events-auto"
      // tldraw layers its own panels up to 99999, and the style panel sits in
      // this same corner. See `floating-menu.ts` for the full note.
      surfaceClassName="z-[100000]"
      signOut={(
        <button
          type="button"
          role="menuitem"
          onClick={() => signOut({ returnTo: "/" })}
          className={MENU_ITEM}
        >
          <LogOut className="size-3.5" aria-hidden="true"/>
          Sign out
        </button>
      )}
    />
  )
}

export default UserBadge
