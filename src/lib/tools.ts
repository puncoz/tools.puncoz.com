import { NotebookPen, PencilRuler, type LucideIcon } from "lucide-react"

/**
 * The tool registry — the single place to edit when adding a tool.
 *
 * The landing page derives its grid, search index and category filters from
 * this list, so a new entry needs no UI changes. Categories are derived rather
 * than declared separately, so a category exists exactly as long as something
 * is in it.
 */

type ToolStatus = "live" | "soon"

type ToolCategory = "canvas" | "writing"

type Tool = {
  /** Stable key, also used as the React list key. */
  slug: string
  name: string
  description: string
  href: string
  icon: LucideIcon
  category: ToolCategory
  status: ToolStatus
  /** Extra search terms that are not in the name or description. */
  keywords: string[]
}

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  canvas: "Canvas & diagrams",
  writing: "Writing",
}

const TOOLS: Tool[] = [
  {
    slug: "draw",
    name: "Draw",
    description: "Infinite canvas for diagrams, sketches and quick visual notes.",
    href: "/draw",
    icon: PencilRuler,
    category: "canvas",
    status: "live",
    keywords: ["tldraw", "whiteboard", "diagram", "sketch", "canvas", "excalidraw"],
  },
  {
    slug: "notes",
    name: "Editor",
    description: "Notion-like editor for writing notes with rich formatting.",
    href: "/notes",
    icon: NotebookPen,
    category: "writing",
    status: "soon",
    keywords: ["notes", "editor", "markdown", "wysiwyg", "notion", "writing"],
  },
]

/** Categories actually in use, in registry order. */
const usedCategories = (tools: Tool[]): ToolCategory[] =>
  [...new Set(tools.map(tool => tool.category))]

/**
 * Case-insensitive match across name, description, category label and keywords,
 * requiring every whitespace-separated term to match somewhere. That makes
 * multi-word queries narrow results instead of widening them.
 */
const matchesQuery = (tool: Tool, query: string): boolean => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

  if (terms.length === 0) {
    return true
  }

  const haystack = [
    tool.name,
    tool.description,
    CATEGORY_LABELS[tool.category],
    ...tool.keywords,
  ].join(" ").toLowerCase()

  return terms.every(term => haystack.includes(term))
}

export { CATEGORY_LABELS, TOOLS, matchesQuery, usedCategories }
export type { Tool, ToolCategory, ToolStatus }
