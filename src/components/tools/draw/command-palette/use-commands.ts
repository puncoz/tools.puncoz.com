"use client"

import { useMemo } from "react"
import { type Editor, GeoShapeGeoStyle, useTools, useTranslation } from "tldraw"
import { SHAPE_TYPE_BY_SET_ID } from "@/components/tools/draw/icon-shape-types"
import { PLACE_ICON_TOOL_ID, type PlaceIconInfo } from "@/components/tools/draw/tools/place-icon-tool"
import type { SearchableCommand } from "@/lib/command-search"
import { ICON_SETS, initialismsOf } from "@/lib/icon-sets"

/**
 * Everything the palette can insert or activate, as one uniform list.
 *
 * Icons could be built in `lib/`, but tools cannot: they come from the
 * `useTools()` hook and their labels are translation keys needing
 * `useTranslation()`. Building all three kinds here keeps one shape of command
 * rather than two assembled in different layers.
 */

type Command = SearchableCommand & {
  /** tldraw icon name, for tool and shape rows. */
  toolIcon?: string
  /** Same-origin SVG URL, for provider icon rows. */
  iconUrl?: string
  run: (editor: Editor) => void
}

type Section = {
  id: string
  label: string
}

/**
 * `asset` and `embed` open a file picker and a URL dialog rather than inserting
 * anything, so they do not belong in an insertion palette.
 */
const EXCLUDED_TOOL_IDS = new Set(["asset", "embed"])

/**
 * Rectangle, ellipse and the other 18 geo values are not separate tools — they
 * are the single `geo` tool plus a style — but tldraw's `useTools()` already
 * spreads one entry per value in (id, label and a working `onSelect`
 * included), pre-split from the rest. Partitioning that list by id, rather
 * than rebuilding the geo-to-tool mapping from `GeoShapeGeoStyle.values` with
 * a hand-rolled `run`, means there is no second copy of tldraw's own logic to
 * silently rot when tldraw changes it — which is exactly the trap an earlier
 * version of this file fell into: it rebuilt the mapping on the mistaken
 * premise that `useTools()` carried no geo entries, and every shape appeared
 * twice, once from each construction.
 */
const GEO_IDS = new Set<string>(GeoShapeGeoStyle.values)

const SECTIONS: readonly Section[] = [
  { id: "tools", label: "Tools" },
  { id: "shapes", label: "Shapes" },
  ...ICON_SETS.map(set => ({ id: set.id, label: set.title })),
]

const SECTION_ORDER = SECTIONS.map(section => section.id)

/** An empty query answers "what can I do", not "here are 404 icons". */
const DEFAULT_SECTIONS = ["tools", "shapes"]

const useCommands = (): readonly Command[] => {
  const tools = useTools()
  const msg = useTranslation()

  return useMemo(() => {
    const toolCommands: Command[] = Object.values(tools)
      .filter(tool => !EXCLUDED_TOOL_IDS.has(tool.id))
      .map(tool => {
        const isGeo = GEO_IDS.has(tool.id)

        return {
          id: `tool:${tool.id}`,
          // Two different translation namespaces, deliberately: tldraw's own
          // `tool.*` table has a hole at `tool.rhombus-2` (every other geo id
          // is there, but that one is not), so a geo entry reads its label
          // from `geo-style.<id>` instead — that namespace is driven by the
          // same `GeoShapeGeoStyle.values` enum that produces `GEO_IDS`, so its
          // completeness is structural, not coincidental. Collapsing this back
          // to one namespace re-opens the hole and silently renders the literal
          // key string "tool.rhombus-2" as a label.
          label: isGeo ? msg(`geo-style.${tool.id}`) : msg(tool.label),
          keywords: tool.id,
          sectionId: isGeo ? "shapes" : "tools",
          toolIcon: typeof tool.icon === "string" ? tool.icon : undefined,
          // Delegating to the tool's own `onSelect` rather than calling
          // `setCurrentTool` ourselves is what keeps a geo entry's style change
          // included — hand-rolling this again is the reimplementation this
          // section's whole comment is about avoiding. "kbd" is an honest
          // `TLUiEventSource`: the palette is a keyboard-driven picker standing
          // in for the shortcut.
          run: () => tool.onSelect("kbd"),
        }
      })

    const iconCommands: Command[] = ICON_SETS.flatMap(set =>
      set.icons.map(icon => ({
        id: `${set.id}:${icon.slug}`,
        label: icon.name,
        // The slug alone leaves nine major AWS services unreachable: the
        // catalogue says "Amazon Simple Storage Service" and people type "s3".
        // `initialismsOf` derives the abbreviation, and reusing it here is what
        // keeps the palette and the dropdowns finding the same things.
        keywords: [icon.slug, ...initialismsOf(icon.name)].join(" "),
        sectionId: set.id,
        iconUrl: set.urlFor(icon.slug),
        run: (editor: Editor) => {
          const shapeType = SHAPE_TYPE_BY_SET_ID[set.id]

          if (!shapeType) {
            return
          }

          const info: PlaceIconInfo = { shapeType, slug: icon.slug, name: icon.name }

          editor.setCurrentTool(PLACE_ICON_TOOL_ID, info)
        },
      })))

    return [...toolCommands, ...iconCommands]
  }, [tools, msg])
}

export default useCommands
export { DEFAULT_SECTIONS, SECTION_ORDER, SECTIONS }
export type { Command, Section }
