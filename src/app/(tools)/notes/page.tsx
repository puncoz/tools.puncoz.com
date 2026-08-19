import UserMenu from "@/components/auth/user-menu"
import Editor from "@/components/editor"
import EditorProvider from "@/components/providers/editor-provider"
import PageShell from "@/components/ui/page-shell"
import { requireAuth } from "@/lib/auth/session"

/**
 * The editor is still a stub — the tool registry marks it `soon` and its card is
 * not a link, so the only way here is typing the URL. It gets the shared shell
 * anyway: an unfinished page that also looks like it belongs to a different site
 * is two problems instead of one.
 */
const NotesPage = async () => {
  await requireAuth()

  return (
    <PageShell crumbs={["Editor"]} actions={<UserMenu/>}>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Editor</h1>

      <p className="mt-2 text-sm text-muted-foreground">
        Not finished yet. Nothing typed here is saved.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <EditorProvider>
          <Editor/>
        </EditorProvider>
      </div>
    </PageShell>
  )
}

export default NotesPage
