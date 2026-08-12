import { handleAuth } from "@workos-inc/authkit-nextjs"
import { NextResponse } from "next/server"
import { syncUser } from "@/lib/auth/sync-user"

export const GET = handleAuth({
  returnPathname: "/",
  onSuccess: async ({ user }) => {
    try {
      await syncUser(user)
    } catch (error) {
      // The local row is a cache, not the source of truth. Never fail sign-in on it.
      console.error("[auth] failed to sync user to database", error)
    }
  },
  onError: ({ error, request }) => {
    console.error("[auth] callback failed", error)

    // Home rather than back to /auth/sign-in: retrying automatically on a
    // persistent failure would loop the user between here and WorkOS.
    return NextResponse.redirect(new URL("/?error=auth", request.url))
  },
})
