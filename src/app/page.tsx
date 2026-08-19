import AccessNotice from "@/components/account/access-notice"
import UserMenu from "@/components/auth/user-menu"
import ImportLegacyDrawings from "@/components/tools/import-legacy-drawings"
import ToolDirectory from "@/components/tools/tool-directory"
import SiteFooter from "@/components/ui/site-footer"
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
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold">{clientConfig.app.shortName}</span>

          <UserMenu/>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        {error === "auth" && (
          <p className="mb-8 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Something went wrong signing you in. Please try again.
          </p>
        )}

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {clientConfig.app.tagline}
        </h1>

        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          {clientConfig.app.description} Sign in once to use any of them.
        </p>

        <div className="mt-8 sm:mt-10">
          {user && <AccessNotice status={user.accessStatus}/>}

          {/* Importing writes drawings, so it needs an account that may own them. */}
          {user && canUseTools(user) && <ImportLegacyDrawings/>}

          <ToolDirectory/>
        </div>

        <SiteFooter/>
      </main>
    </div>
  )
}

export default HomePage
