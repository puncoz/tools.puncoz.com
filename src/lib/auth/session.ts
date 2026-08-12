import "server-only"
import { withAuth } from "@workos-inc/authkit-nextjs"
import type { User } from "@workos-inc/node"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { safeReturnTo } from "@/lib/auth/return-to"

/**
 * Returns the signed-in user, or null. Use on pages that work either way.
 *
 * Environment configuration is validated once at boot by `instrumentation.ts`,
 * so there is nothing to assert here.
 */
const getCurrentUser = async (): Promise<User | null> => {
  const { user } = await withAuth()

  return user
}

/**
 * Path of the request being rendered, so a guard can send the user back where
 * they were aiming.
 *
 * Server components cannot read the pathname directly. AuthKit's proxy forwards
 * the full request URL as an `x-url` request header (and overwrites any
 * client-supplied value), which is the same source AuthKit uses internally.
 * Only the path is taken, and it still passes through `safeReturnTo`.
 */
const currentPath = async (): Promise<string> => {
  const url = (await headers()).get("x-url")

  if (!url) {
    return "/"
  }

  try {
    const { pathname, search } = new URL(url)

    return safeReturnTo(`${pathname}${search}`)
  } catch {
    return "/"
  }
}

/**
 * Guards a route, sending signed-out users straight to the AuthKit hosted UI
 * with an accurate return path. The redirect goes to /auth/sign-in rather than
 * to WorkOS directly because minting the URL writes the PKCE cookie, which
 * Next.js only permits from a route handler.
 *
 * Next.js layouts do not re-run on client-side navigation, so this must be
 * called by the page itself — a layout-only check is not a security boundary.
 */
const requireAuth = async (): Promise<User> => {
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/auth/sign-in?returnTo=${encodeURIComponent(await currentPath())}`)
  }

  return user
}

export { getCurrentUser, requireAuth }
export type { User }
