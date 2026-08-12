"use client"

import { FunctionComponent } from "react"
import { Tldraw } from "tldraw"
import "tldraw/tldraw.css"

const DrawCanvas: FunctionComponent = () => {
  return (
    <div className="fixed inset-0">
      <Tldraw persistenceKey="tools.puncoz.com"/>
    </div>
  )
}

export default DrawCanvas
