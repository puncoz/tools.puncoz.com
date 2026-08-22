import { authkitProxy } from "@workos-inc/authkit-nextjs"

// Next.js 16 replaces `middleware.ts` with `proxy.ts`. No `middlewareAuth` here:
// the proxy only keeps the session cookie fresh. Route protection is each page's
// job via `requireAuth()`, so signed-out users land on /login rather than being
// bounced straight to the AuthKit hosted UI.
export default authkitProxy()

// Every authenticated route must stay inside this matcher: `withAuth` throws
// outright on a path the AuthKit proxy does not cover, so a route cannot be
// excluded here just to change how it is cached.
//
// That warning used to say routes could not escape "the no-store Cache-Control
// the proxy stamps on everything". Measured, the proxy does no such thing —
// `authkit-nextjs@4` sets `cache-control` only when it is itself setting a
// cookie, and the `no-store` on HTML documents is Next's own default for a
// dynamic render. A route handler's own `Cache-Control` reaches the browser
// intact; `api/drawings/[id]/thumbnail` relies on exactly that. See ADR 0008.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
