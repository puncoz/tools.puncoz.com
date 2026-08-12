"use client"

import type { FunctionComponent } from "react"
import { Tldraw, type TLComponents } from "tldraw"
import HomeButton from "@/components/tools/draw/home-button"
import ProjectMenu from "@/components/tools/draw/project-menu"
import UserBadge from "@/components/tools/draw/user-badge"
import "tldraw/tldraw.css"

/**
 * Custom chrome injected into tldraw's own floating UI zones instead of a
 * header bar above the canvas — the canvas stays full-bleed and loses no space.
 *
 *   MenuPanel  (top-left)   home button + tldraw's default menus
 *   TopPanel   (top-centre) project name
 *   SharePanel (top-right)  account
 *
 * Defined at module scope: passing a new object each render would remount every
 * panel on every render.
 */
const components: TLComponents = {
  MenuPanel: HomeButton,
  TopPanel: ProjectMenu,
  SharePanel: UserBadge,
}

const DrawCanvas: FunctionComponent = () => {
  return (
    <div className="fixed inset-0">
      <Tldraw persistenceKey="tools.puncoz.com" components={components}/>
    </div>
  )
}

export default DrawCanvas
