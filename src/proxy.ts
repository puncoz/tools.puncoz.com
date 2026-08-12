import { authkitProxy } from "@workos-inc/authkit-nextjs"

// Next.js 16 replaces `middleware.ts` with `proxy.ts`. No `middlewareAuth` here:
// the proxy only keeps the session cookie fresh. Route protection is each page's
// job via `requireAuth()`, so signed-out users land on /login rather than being
// bounced straight to the AuthKit hosted UI.
export default authkitProxy()

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
