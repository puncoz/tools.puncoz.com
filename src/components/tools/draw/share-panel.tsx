"use client"

import type { FunctionComponent } from "react"
import SaveStatus from "@/components/tools/draw/save-status"
import UserBadge from "@/components/tools/draw/user-badge"

/** tldraw's top-right zone: save feedback next to the account menu. */
const SharePanel: FunctionComponent = () => (
  <div className="flex items-center gap-1">
    <SaveStatus/>
    <UserBadge/>
  </div>
)

export default SharePanel
