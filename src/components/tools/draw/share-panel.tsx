"use client"

import type { FunctionComponent } from "react"
import { PANEL_CLASSES } from "@/components/tools/draw/floating-menu"
import SaveStatus from "@/components/tools/draw/save-status"
import ShareMenu from "@/components/tools/draw/share-menu"
import UserBadge from "@/components/tools/draw/user-badge"
import ThemeMenu from "@/components/ui/theme-menu"

/**
 * tldraw's top-right zone: save feedback, sharing, theme, then the account menu.
 *
 * Same order and same two controls as the site header, so the canvas does not
 * feel like a different application. The theme control has to be here at all
 * because this page has no header — it is the one surface where the difference
 * between light and dark is most of what you are looking at.
 */
const SharePanel: FunctionComponent = () => (
  <div className="flex items-center gap-1">
    <SaveStatus/>
    <ShareMenu/>

    {/* Given the panel surface the other canvas controls use: a bare icon over
        a drawing is invisible the moment someone draws something pale behind
        it. `PANEL_CLASSES` also carries the `pointer-events-auto` that tldraw's
        zones require, and the z-index note lives in `floating-menu.ts`. */}
    <ThemeMenu className={PANEL_CLASSES} surfaceClassName="z-[100000]"/>

    <UserBadge/>
  </div>
)

export default SharePanel
