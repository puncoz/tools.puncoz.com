"use client"

import { Check, ChevronDown } from "lucide-react"
import type { FunctionComponent } from "react"
import { type TLPageId, useEditor, useValue } from "tldraw"
import { DROPDOWN_CLASSES, PANEL_CLASSES, useDismissableMenu } from "@/components/tools/draw/floating-menu"
import { cn } from "@/lib/utils"

/**
 * Page switcher for the shared canvas.
 *
 * A tldraw document can hold many pages, and imported ones routinely do — the
 * drawing this was written for has thirteen. The editor already offers tldraw's
 * own page menu, because `home-button.tsx` renders `DefaultMenuPanel` alongside
 * its own controls. The share view does not: it clears the whole menu zone, so
 * everything past the first page was unreachable behind a share link.
 *
 * Custom rather than un-nulling tldraw's `PageMenu`, for two reasons. Its
 * read-only mode still renders "Create new page" and the per-page submenu, only
 * disabled, which is dead chrome on a link handed to someone else. And it lives
 * in the top-left menu zone, where the share page already pins its title and
 * "Read-only" badge.
 */
const PageSwitcher: FunctionComponent = () => {
  const editor = useEditor()
  const { open, setOpen, ref } = useDismissableMenu<HTMLDivElement>()

  // Reactive reads: switching pages must re-render the trigger, and a page
  // renamed by the owner mid-visit should not leave a stale name behind.
  const pages = useValue("pages", () => editor.getPages(), [editor])
  const currentPageId = useValue("currentPageId", () => editor.getCurrentPageId(), [editor])

  // Nothing to switch between, so nothing to show. Single-page drawings — which
  // is every drawing created here rather than imported — look exactly as they
  // did before this existed.
  if (pages.length < 2) {
    return null
  }

  const goToPage = (pageId: TLPageId) => {
    setOpen(false)
    editor.setCurrentPage(pageId)
    // tldraw keeps a camera per page, so a page opened for the first time starts
    // at the origin — and imported content often sits nowhere near it, leaving a
    // visitor staring at blank canvas. Same reason the initial mount fits.
    editor.zoomToFit({ animation: { duration: 0 } })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(PANEL_CLASSES, "flex max-w-[40vw] items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent")}
      >
        <span className="truncate">
          {pages.find(page => page.id === currentPageId)?.name ?? "Pages"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true"/>
      </button>

      {open && (
        // Capped and scrollable: thirteen pages is already past what fits, and
        // an imported document has no upper bound worth trusting.
        <div role="menu" className={cn(DROPDOWN_CLASSES, "left-1/2 max-h-72 w-64 -translate-x-1/2 overflow-y-auto")}>
          {pages.map(page => (
            <button
              key={page.id}
              type="button"
              role="menuitem"
              onClick={() => goToPage(page.id)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                page.id !== currentPageId && "pl-8",
              )}
            >
              {page.id === currentPageId && (
                <Check className="size-3.5 shrink-0" aria-hidden="true"/>
              )}
              <span className="truncate">{page.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default PageSwitcher
