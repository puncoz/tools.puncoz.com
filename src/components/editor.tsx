"use client"
import { EditorContent, EditorRoot, type JSONContent } from "novel"
import { FunctionComponent, useState } from "react"

const Editor: FunctionComponent = () => {
  const [content, setContent] = useState<JSONContent>()

  return (
    <EditorRoot>
      <EditorContent initialContent={content}
                     onUpdate={({ editor }) => {
                       const json = editor.getJSON()
                       setContent(json)
                     }}/>
    </EditorRoot>
  )
}

export default Editor
