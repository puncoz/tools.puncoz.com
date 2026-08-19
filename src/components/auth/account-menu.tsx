"use client"

import { Settings, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { type FunctionComponent, type ReactNode, useState } from "react"
import { MENU_ITEM, MENU_SURFACE, useDismissableMenu } from "@/components/ui/menu"
import { cn } from "@/lib/utils"

type AccountUser = Readonly<{
  email: string
  /** Full name, when the identity provider supplied one. */
  name: string | null
  /** WorkOS-hosted profile picture. Null when there is none. */
  avatarUrl: string | null
}>

type Props = Readonly<{
  user: AccountUser
  /** Server-side check on `ADMIN_EMAILS`, so it cannot be derived client-side. */
  isAdmin?: boolean
  /**
   * The sign-out control, supplied by the caller because the mechanism differs
   * by surface: a server-action form in the header, AuthKit's client `signOut()`
   * on the canvas, where tldraw instantiates the panel with no props. Style it
   * with `MENU_ITEM`.
   */
  signOut: ReactNode
  /** Menu surface, for the canvas where it has to out-stack tldraw's panels. */
  surfaceClassName?: string
  /** Wrapper, for the canvas where tldraw's zones are pointer-events-none. */
  className?: string
}>

const initialsFrom = (user: AccountUser): string => {
  const fromName = (user.name ?? "")
    .split(/\s+/)
    .flatMap(part => part ? [part.charAt(0)] : [])
    .join("")

  return (fromName || user.email.charAt(0)).toUpperCase().slice(0, 2)
}

/**
 * Who you are, and everything you can do about it, behind one avatar.
 *
 * Replaces a row of loose icon links — People, Settings, Sign out — that sat
 * beside the theme control and read as scattered because it was four unrelated
 * things at the same visual weight.
 *
 * A plain `<img>` for the avatar rather than `next/image`. WorkOS serves these
 * from `workoscdn.com`, and pointing the optimiser at a third-party host means
 * adding it to `remotePatterns` and revisiting that every time the provider
 * changes CDN — for a 32-pixel image. It also means a broken picture can fall
 * back to initials here, which a server-rendered `<Image>` could not do.
 */
const AccountMenu: FunctionComponent<Props> = ({
  user,
  isAdmin,
  signOut,
  surfaceClassName,
  className,
}) => {
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()
  const [avatarFailed, setAvatarFailed] = useState(false)

  const showAvatar = user.avatarUrl !== null && !avatarFailed
  const label = user.name ?? user.email

  const avatar = (size: string) => (
    showAvatar
      ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl ?? ""}
          alt=""
          onError={() => setAvatarFailed(true)}
          className={cn(size, "shrink-0 rounded-full object-cover")}
        />
      )
      : (
        <span
          className={cn(
            size,
            "flex shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand",
          )}
        >
          {initialsFrom(user)}
        </span>
      )
  )

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${label}`}
        title={label}
        className="flex rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {avatar("size-8")}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            MENU_SURFACE,
            "absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden py-1",
            surfaceClassName,
          )}
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            {avatar("size-9")}

            <div className="min-w-0">
              {user.name && <p className="truncate text-sm font-medium">{user.name}</p>}

              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="my-1 h-px bg-border"/>

          {isAdmin && (
            <Link href="/admin/users" role="menuitem" className={MENU_ITEM}>
              <ShieldCheck className="size-3.5" aria-hidden="true"/>
              People
            </Link>
          )}

          <Link href="/settings/storage" role="menuitem" className={MENU_ITEM}>
            <Settings className="size-3.5" aria-hidden="true"/>
            Settings
          </Link>

          <div className="my-1 h-px bg-border"/>

          {signOut}
        </div>
      )}
    </div>
  )
}

export default AccountMenu
export type { AccountUser }
