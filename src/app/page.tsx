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

const HomePage = () => {
  return (
    <div className="h-screen w-full flex items-center justify-center">
      <HoverEffect items={tools.filter(tool => tool.active)}/>
    </div>
  )
}

export default HomePage
