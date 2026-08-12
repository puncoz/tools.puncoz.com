import { redirect } from "next/navigation"
import { requireDbUser } from "@/lib/auth/current-user"
import { createDrawing, getMostRecentDrawing } from "@/lib/drawings/queries"

/**
 * /draw has no canvas of its own — it resolves to a drawing.
 *
 * Sending people to their most recent drawing makes the bare URL a useful
 * bookmark, and creating one on demand means a new account never lands on an
 * empty state it has to click through.
 */
const DrawIndexPage = async () => {
  const user = await requireDbUser()
  const recent = await getMostRecentDrawing(user.id)

  if (recent) {
    redirect(`/draw/${recent.id}`)
  }

  const created = await createDrawing(user.id)

  redirect(`/draw/${created.id}`)
}

export default DrawIndexPage
