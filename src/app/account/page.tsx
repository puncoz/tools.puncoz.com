import { Clock, ShieldBan, ShieldX } from "lucide-react"
import { redirect } from "next/navigation"
import ReapplyForm from "@/components/account/reapply-form"
import PageShell from "@/components/ui/page-shell"
import { canUseTools, reapplyAvailableAt } from "@/lib/auth/access"
// One of only three places allowed to reach a non-approved user — this page
// exists precisely to explain to them why they are not approved.
import { requireAccountUser } from "@/lib/auth/current-user"

export const dynamic = "force-dynamic"

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" })

/**
 * Where anyone without tool access lands after signing in.
 *
 * Deliberately outside the `(tools)` route group, so it is not subject to the
 * approval guard whose outcome it exists to explain.
 */
const AccountPage = async () => {
  const user = await requireAccountUser()

  // Approved users have nothing to read here.
  if (canUseTools(user)) {
    redirect("/")
  }

  const availableAt = reapplyAvailableAt(user)

  return (
    <PageShell crumbs={["Account"]}>
        {user.accessStatus === "pending" && (
          <>
            <Clock className="size-8 text-muted-foreground" aria-hidden="true"/>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              Your access is being reviewed
            </h1>

            <p className="mt-2 max-w-xl text-muted-foreground">
              Thanks for signing in. This is a personal site, so access is granted by
              hand — I will look at your request and you will have access here the next
              time you sign in once it is approved.
            </p>

            <p className="mt-4 text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.email}</span>.
            </p>
          </>
        )}

        {user.accessStatus === "declined" && (
          <>
            <ShieldX className="size-8 text-muted-foreground" aria-hidden="true"/>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              Your request was not approved
            </h1>

            <p className="mt-2 max-w-xl text-muted-foreground">
              Access to this site is granted individually, and your request was not
              approved this time.
            </p>

            {user.accessNote && (
              <blockquote className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                {user.accessNote}
              </blockquote>
            )}

            <ReapplyForm
              availableAtLabel={availableAt ? dateFormat.format(availableAt) : null}
            />
          </>
        )}

        {user.accessStatus === "banned" && (
          <>
            <ShieldBan className="size-8 text-destructive" aria-hidden="true"/>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight">
              Your access has been removed
            </h1>

            <p className="mt-2 max-w-xl text-muted-foreground">
              This account can no longer use the tools on this site.
            </p>

            {user.accessNote && (
              <blockquote className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                {user.accessNote}
              </blockquote>
            )}
          </>
        )}
    </PageShell>
  )
}

export default AccountPage
