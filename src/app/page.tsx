import UserMenu from "@/components/auth/user-menu"
import { clientConfig } from "@/config/client"
import { HoverEffect } from "@/components/ui/card-hover-effect"

const tools = [
  {
    active: true,
    title: "Draw",
    description: "Drawing tools to help you draw diagrams and notes",
    link: "/draw",
  },
  {
    active: false,
    title: "Editor",
    description: "Notion like editor to help you write notes",
    link: "/notes",
  },
]

type Props = {
  searchParams: Promise<{ error?: string }>
}

// Renders per-user auth state in the header, so it cannot be prerendered.
export const dynamic = "force-dynamic"

const HomePage = async ({ searchParams }: Props) => {
  const { error } = await searchParams

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold">{clientConfig.app.shortName}</span>

        <UserMenu/>
      </header>

      {error === "auth" && (
        <p className="mx-6 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Something went wrong signing you in. Please try again.
        </p>
      )}

      <div className="flex w-full flex-1 items-center justify-center">
        <HoverEffect items={tools.filter(tool => tool.active)}/>
      </div>
    </div>
  )
}

export default HomePage
