import { getSignInUrl } from "@workos-inc/authkit-nextjs"
import { type NextRequest, NextResponse } from "next/server"
import { safeReturnTo } from "@/lib/auth/return-to"

/**
 * Starts the AuthKit flow.
 *
 * This lives in a route handler rather than the login page because
 * `getSignInUrl()` writes the PKCE code verifier to a cookie, and Next.js only
 * allows cookie writes from Server Actions and Route Handlers — calling it
 * during a server component render throws.
 *
 * `returnTo` is re-validated here rather than trusted from the login page,
 * since this endpoint is reachable directly.
 */
export const GET = async (request: NextRequest): Promise<Response> => {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"))
  const signInUrl = await getSignInUrl({ returnTo })

  return NextResponse.redirect(signInUrl)
}
