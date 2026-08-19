import AccessNotice from "@/components/account/access-notice"
import UserMenu from "@/components/auth/user-menu"
import ImportLegacyDrawings from "@/components/tools/import-legacy-drawings"
import ToolDirectory from "@/components/tools/tool-directory"
import PageShell from "@/components/ui/page-shell"
import { clientConfig } from "@/config/client"
import { canUseTools } from "@/lib/auth/access"
import { getAccountUser } from "@/lib/auth/current-user"

type Props = {
  searchParams: Promise<{ error?: string }>
}

// Renders per-user auth state in the header, so it cannot be prerendered.
export const dynamic = "force-dynamic"

const HomePage = async ({ searchParams }: Props) => {
  const { error } = await searchParams
  // The landing page is the one signed-in surface that renders for unapproved
  // users, so it reads the account row rather than the approved-only helper.
  const user = await getAccountUser()

  return (
    <PageShell actions={<UserMenu/>}>
      {error === "auth" && (
        <p className="mb-8 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Something went wrong signing you in. Please try again.
        </p>
      )}

      <div className="relative">
        {/* A wash of the brand behind the heading. Purely atmospheric, so it is
            hidden from assistive tech and cannot intercept a click. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-0 -z-10 h-72 w-[34rem] max-w-full rounded-full bg-brand/10 blur-3xl"
        />

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {clientConfig.app.tagline}
        </h1>

        <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
          {clientConfig.app.description} Sign in once to use any of them.
        </p>
      </div>

      <div className="mt-10 sm:mt-12">
        {user && <AccessNotice status={user.accessStatus}/>}

        {/* Importing writes drawings, so it needs an account that may own them. */}
        {user && canUseTools(user) && <ImportLegacyDrawings/>}

        <ToolDirectory/>
      </div>
    </PageShell>
  )
}

export default HomePage
