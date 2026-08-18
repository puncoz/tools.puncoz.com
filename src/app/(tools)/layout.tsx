import React from "react"
import { requireDbUser } from "@/lib/auth/current-user"

type Props = Readonly<{
  children: React.ReactNode
}>

// Applies to every tool in this group: they are gated on the session, so none
// of them can be prerendered.
export const dynamic = "force-dynamic"

/**
 * Every tool lives under this route group and inherits both authentication and
 * approval. This is defence in depth — the page-level `requireDbUser()` is the
 * real guarantee, because layouts do not re-run on client-side navigation, and
 * the API routes are guarded independently at the choke point in
 * `lib/auth/current-user.ts`.
 */
const ToolsLayout = async ({ children }: Props) => {
  await requireDbUser()

  return <>{children}</>
}

export default ToolsLayout
