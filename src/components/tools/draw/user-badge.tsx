"use client"

import { useAuth } from "@workos-inc/authkit-nextjs/components"
import { LogOut, Settings } from "lucide-react"
import Link from "next/link"
import type { FunctionComponent } from "react"
import { DROPDOWN_CLASSES, PANEL_CLASSES, useDismissableMenu } from "@/components/tools/draw/floating-menu"
import { cn } from "@/lib/utils"

const initialFor = (name: string | null, email: string): string =>
  (name?.trim()?.[0] ?? email[0] ?? "?").toUpperCase()

/**
 * Rendered into tldraw's `SharePanel` zone (top-right): who you are, and a way
 * to sign out without leaving the canvas.
 *
 * Reads the session through AuthKit's client context rather than props, since
 * tldraw instantiates these components itself and gives no way to pass data in.
 */
const UserBadge: FunctionComponent = () => {
  const { user, loading, signOut } = useAuth()
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()

  if (loading || !user) {
    return null
  }

  const label = user.firstName ?? user.email

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${label}`}
        title={label}
        className={cn(PANEL_CLASSES, "flex size-9 items-center justify-center text-sm font-medium transition-colors hover:bg-accent")}
      >
        {initialFor(user.firstName, user.email)}
      </button>

      {open && (
        <div role="menu" className={cn(DROPDOWN_CLASSES, "right-0 w-56")}>
          <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user.email}</p>

          <div className="my-1 h-px bg-border"/>

          <Link
            href="/settings/storage"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <Settings className="size-3.5" aria-hidden="true"/>
            Storage settings
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ returnTo: "/" })}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            <LogOut className="size-3.5" aria-hidden="true"/>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default UserBadge
