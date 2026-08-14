"use client"

import type { FunctionComponent } from "react"
import SaveStatus from "@/components/tools/draw/save-status"
import ShareMenu from "@/components/tools/draw/share-menu"
import UserBadge from "@/components/tools/draw/user-badge"

/** tldraw's top-right zone: save feedback, sharing, then the account menu. */
const SharePanel: FunctionComponent = () => (
  <div className="flex items-center gap-1">
    <SaveStatus/>
    <ShareMenu/>
    <UserBadge/>
  </div>
)

export default SharePanel
