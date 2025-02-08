import { HoverEffect } from "@/components/ui/card-hover-effect"

const tools = [
  {
    title: "Draw",
    description: "Drawing tools to help you draw diagrams and notes",
    link: "/draw",
  },
  {
    title: "Editor",
    description: "Notion like editor to help you write notes",
    link: "/notes",
  },
]

const HomePage = () => {
  return (
    <div className="h-screen w-full flex items-center">
      <HoverEffect items={tools}/>
    </div>
  )
}

export default HomePage
