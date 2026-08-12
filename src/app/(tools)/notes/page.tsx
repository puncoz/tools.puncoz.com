import Editor from "@/components/editor"
import EditorProvider from "@/components/providers/editor-provider"
import { requireAuth } from "@/lib/auth/session"

const NotesPage = async () => {
  await requireAuth()

  return (
    <EditorProvider>
      <Editor/>
    </EditorProvider>
  )
}

export default NotesPage
