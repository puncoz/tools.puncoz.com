import Editor from "@/components/editor"
import EditorProvider from "@/components/providers/editor-provider"
import { FunctionComponent } from "react"

const NotesPage: FunctionComponent = () => {
  return (
    <EditorProvider>
      <Editor/>
    </EditorProvider>
  )
}

export default NotesPage
