import { ArrowRight, Clock, ShieldBan, ShieldX } from "lucide-react"
import Link from "next/link"
import type { FunctionComponent } from "react"
import type { AccessStatus } from "@/db/schema"

type Props = Readonly<{
  status: AccessStatus
}>

const NOTICES: Record<Exclude<AccessStatus, "approved">, { icon: typeof Clock, text: string }> = {
  pending: {
    icon: Clock,
    text: "Your access is being reviewed. The tools below will open once it is approved.",
  },
  declined: {
    icon: ShieldX,
    text: "Your access request was not approved.",
  },
  banned: {
    icon: ShieldBan,
    text: "This account can no longer use the tools on this site.",
  },
}

/**
 * Shown on the landing page to a signed-in visitor who cannot use the tools.
 *
 * The grid stays visible — seeing what is behind the door is the point of asking
 * for access — but this says plainly why clicking will not work, rather than
 * letting them find out by being bounced.
 */
const AccessNotice: FunctionComponent<Props> = ({ status }) => {
  if (status === "approved") {
    return null
  }

  const { icon: Icon, text } = NOTICES[status]

  return (
    <div className="mb-8 flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true"/>

      <p className="flex-1 text-sm text-muted-foreground">
        {text}{" "}
        <Link href="/account" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
          Details
          <ArrowRight className="size-3" aria-hidden="true"/>
        </Link>
      </p>
    </div>
  )
}

export default AccessNotice
