import { NextResponse } from "next/server"
import { getDbUser } from "@/lib/auth/current-user"
import { emptyTrash } from "@/lib/drawings/queries"

/**
 * Empties the trash.
 *
 * A static segment sitting beside `[id]`, which Next resolves first — no drawing
 * id can shadow it, since they are uuids. Per-drawing restore and permanent
 * delete live at `[id]/trash`.
 */
export const DELETE = async (): Promise<Response> => {
  const user = await getDbUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ purged: await emptyTrash(user.id) })
}
