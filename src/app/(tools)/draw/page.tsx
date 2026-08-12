import DrawCanvas from "@/components/tools/draw-canvas"
import { requireAuth } from "@/lib/auth/session"

const DrawPage = async () => {
  await requireAuth()

  return <DrawCanvas/>
}

export default DrawPage
