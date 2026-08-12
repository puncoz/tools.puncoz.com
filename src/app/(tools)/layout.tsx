import React from "react"
import { requireAuth } from "@/lib/auth/session"

type Props = Readonly<{
  children: React.ReactNode
}>

// Applies to every tool in this group: they are gated on the session, so none
// of them can be prerendered.
export const dynamic = "force-dynamic"

/**
 * Every tool lives under this route group and inherits authentication. This
 * check is defense-in-depth — the page-level `requireAuth()` is the real
 * guarantee, because layouts do not re-run on client-side navigation.
 */
const ToolsLayout = async ({ children }: Props) => {
  await requireAuth()

  return <>{children}</>
}

export default ToolsLayout
