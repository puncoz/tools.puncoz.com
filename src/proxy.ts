import { authkitProxy } from "@workos-inc/authkit-nextjs"

// Next.js 16 replaces `middleware.ts` with `proxy.ts`. No `middlewareAuth` here:
// the proxy only keeps the session cookie fresh. Route protection is each page's
// job via `requireAuth()`, so signed-out users land on /login rather than being
// bounced straight to the AuthKit hosted UI.
export default authkitProxy()

// Every authenticated route must stay inside this matcher: `withAuth` throws
// outright on a path the AuthKit proxy does not cover, so routes cannot be
// excluded here to escape the no-store `Cache-Control` the proxy stamps on
// everything (see `api/drawings/[id]/thumbnail`).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
