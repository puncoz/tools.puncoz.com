"use client"

import { Search } from "lucide-react"
import { type FunctionComponent, type KeyboardEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { TldrawUiIcon, useEditor } from "tldraw"
import {
  getPaletteSnapshot,
  getServerPaletteSnapshot,
  setPaletteOpen,
  subscribePalette,
  usePaletteShortcut,
} from "@/components/tools/draw/command-palette/palette-store"
import useCommands, {
  DEFAULT_SECTIONS,
  SECTION_ORDER,
  SECTIONS,
  type Command,
} from "@/components/tools/draw/command-palette/use-commands"
import { MENU_SURFACE } from "@/components/ui/menu"
import { searchCommands } from "@/lib/command-search"
import { cn } from "@/lib/utils"

/**
 * A `/` command palette for inserting shapes, activating tools and placing
 * provider icons, layered over the tldraw canvas.
 *
 * Typing `rect` into the palette must not fire tldraw's `e` (eraser) and `t`
 * (text) on the way past. tldraw gates every shortcut on
 * `areShortcutsDisabled(editor)`, which checks `editor.menus.hasAnyOpenMenus()`
 * (`lib/ui/hooks/useKeyboardShortcuts.js:181`) — so registering as an open menu
 * is the supported way to make it stand down, and is why this component
 * swallows no keystrokes of its own.
 */

const MENU_ID = "command-palette"

/** Ties the input's `aria-controls` to the listbox it owns. */
const LISTBOX_ID = "command-palette-listbox"

/**
 * Surface for the dialog itself. `DROPDOWN_CLASSES` (`floating-menu.ts`) exists
 * for a menu anchored under a trigger button — it carries `absolute top-full`,
 * which is the wrong anchor for a dialog centred over the whole canvas rather
 * than pinned beneath one control. Composing `MENU_SURFACE` directly with its
 * own `fixed` placement avoids stacking a `static`/`fixed` pair whose winner
 * depends on stylesheet order rather than anything visible in this file.
 *
 * The z-index is deliberately one *above* `DROPDOWN_CLASSES`'s `100000`, not
 * merely equal to it, so the palette cannot end up underneath an icon-picker
 * dropdown that happens to still be mounted. That comparison is only
 * meaningful because the dialog is portalled to `document.body` (see below) —
 * inside `.tl-canvas__in-front`, a `z-[100001]` on this element would be
 * scoped to that zone's own stacking context and could not outrank anything
 * outside it, dropdowns included.
 *
 * Height is capped to the viewport (`max-h-[calc(100vh-8rem)]`, matching the
 * `top-24` offset) with `overflow-y-auto` on this surface itself, not just the
 * inner result list — `top-24` plus the input plus a full `max-h-96` list plus
 * the footer is comfortably taller than a short laptop or a phone in landscape,
 * and clipping instead of scrolling would leave the footer unreachable rather
 * than merely offscreen.
 */
const DIALOG_CLASSES = `pointer-events-auto ${MENU_SURFACE} fixed left-1/2 top-24 z-[100001] w-[32rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] -translate-x-1/2 overflow-y-auto p-2`

const CommandPalette: FunctionComponent = () => {
  const editor = useEditor()
  const open = useSyncExternalStore(subscribePalette, getPaletteSnapshot, getServerPaletteSnapshot)
  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  usePaletteShortcut(editor)

  const commands = useCommands()

  const { commands: results, total } = useMemo(
    () => searchCommands(commands, query, {
      sectionOrder: SECTION_ORDER,
      defaultSections: DEFAULT_SECTIONS,
    }),
    [commands, query],
  )

  /**
   * Sections render in a fixed order (`SECTIONS`), while `results` is sorted
   * rank-first — so once more than one section has matches, the order rows
   * actually appear on screen diverges from `results`' own array order. Arrow
   * key movement, `aria-activedescendant` and Enter all need to agree with
   * what is visually highlighted, so they key off this flattened, display-order
   * list rather than off `results` directly.
   */
  const flatOrder = useMemo(
    () => SECTIONS.flatMap(section => results.filter(command => command.sectionId === section.id)),
    [results],
  )

  /**
   * A row's on-screen position, by command id. Built once per `flatOrder`
   * change instead of a `let` counter incremented inside the nested render
   * `.map()`s below — a mutable counter captured across those closures is
   * exactly what `react-hooks/immutability` flags, since components are
   * expected to stay pure between renders.
   */
  const indexByCommandId = useMemo(
    () => new Map(flatOrder.map((command, index) => [command.id, index])),
    [flatOrder],
  )

  /**
   * Registering as an open menu disables tldraw's single-key shortcuts, so
   * typing "rect" does not activate the eraser and the text tool on the way
   * past. The cleanup must also run on unmount, or the canvas is left with every
   * shortcut dead and no visible cause.
   */
  useEffect(() => {
    if (!open) {
      return
    }

    editor.menus.addOpenMenu(MENU_ID)

    return () => {
      // The brief called this `removeOpenMenu`; tldraw's actual `EditorMenus`
      // API (`node_modules/tldraw/dist-cjs/index.d.ts`) names it
      // `deleteOpenMenu` — using the name that compiles rather than the one
      // written down.
      editor.menus.deleteOpenMenu(MENU_ID)
    }
  }, [editor, open])

  /**
   * `open` lives in a module-level store, so it outlives this component — a
   * client-side route change from `/draw/a` to `/draw/b` unmounts and remounts
   * this component, but the store's `open` flag survives that transition
   * untouched. Without this, leaving the palette open and navigating leaves it
   * stuck open on arrival at the new drawing. This is deliberately a separate,
   * empty-dependency effect rather than folded into the one above: that one
   * re-runs on every `open` change to mirror tldraw's menu registration to the
   * palette's current state, while this one only needs to fire once, on
   * unmount. It does not fight that cleanup — `deleteOpenMenu` above only runs
   * when the palette was registered as open, and `setPaletteOpen` here is a
   * no-op once it already is closed (see `palette-store.ts`), so the two never
   * race over the same piece of state.
   */
  useEffect(() => {
    return () => {
      setPaletteOpen(false)
    }
  }, [])

  const close = () => {
    setPaletteOpen(false)
    setQuery("")
    setHighlighted(0)
    // Without this, Escape leaves the keyboard dead and the next tool shortcut
    // silently does nothing — which reads as the palette having broken the page.
    editor.focus()
  }

  const run = (command: Command) => {
    close()
    command.run(editor)
  }

  // A new query means the old highlight index points at a different command.
  // Resetting this from inside a `useEffect` calls `setState` synchronously in
  // an effect body, which lint (`react-hooks/set-state-in-effect`) flags as an
  // avoidable extra render per keystroke. Comparing the previous query during
  // render and adjusting state right here — not in an effect — is the pattern
  // React's own docs recommend for "adjusting state when a prop changes".
  const [previousQuery, setPreviousQuery] = useState(query)

  if (query !== previousQuery) {
    setPreviousQuery(query)
    setHighlighted(0)
  }

  /**
   * Lives on the dialog container, not the input, so it catches every key that
   * bubbles from any descendant — a mouse click on an option row (or on the
   * section header, or on the dialog's own padding) moves focus off the input,
   * and a handler attached only there would go silent from that point on.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      close()

      return
    }

    // The palette has exactly one focusable control (the input; every option
    // row below is `tabIndex={-1}`) and is entirely arrow-driven, so Tab has
    // nothing useful to do inside it. Left alone, Tab walks focus out of the
    // dialog entirely — to whatever tldraw chrome sits behind the overlay —
    // and once focus is outside, this handler stops receiving anything: no
    // more Escape, no more arrows, and `editor.menus` is still holding the
    // canvas shortcuts suppressed with no visible reason why. Trapping it here
    // is also what makes the `aria-modal="true"` on the dialog honest rather
    // than aspirational.
    if (event.key === "Tab") {
      event.preventDefault()
      inputRef.current?.focus()

      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlighted(current => Math.min(current + 1, flatOrder.length - 1))

      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlighted(current => Math.max(current - 1, 0))

      return
    }

    if (event.key === "Enter") {
      event.preventDefault()

      const command = flatOrder[highlighted]

      if (command) {
        run(command)
      }
    }
  }

  /**
   * Backstop for the one path the handler above cannot see: a mousedown on
   * something with no text to select — the section header, the dialog's own
   * padding, the footer — blurs the input to `<body>` in Chrome and Safari
   * without moving focus to any element *inside* the dialog. `<body>` is
   * outside this component's DOM subtree, so no bubbling keydown ever reaches
   * `onKeyDown` above; only a `document` listener sees it.
   *
   * `useDismissableMenu` (`components/ui/menu.ts`) was the first thing checked
   * for this, per the house rule against hand-rolling dismissal, but it does
   * not fit: it owns its own `open` boolean via `useState`, while this
   * component's `open` lives in the module-level palette store — wiring it in
   * would mean either running two copies of "is the palette open" that could
   * drift apart, or reworking every other consumer of the store to go through
   * it instead. Its outside-pointerdown handling would also duplicate the
   * full-screen overlay below, which already closes on any click outside the
   * dialog. So only the one behaviour neither of those covers — Escape while
   * focus has drifted to `<body>` — is reproduced here, kept symmetric with
   * `useDismissableMenu`'s own pattern: attached only while open, torn down
   * the same way.
   */
  useEffect(() => {
    if (!open) {
      return
    }

    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && document.activeElement === document.body) {
        close()
      }
    }

    document.addEventListener("keydown", onDocumentKeyDown)

    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `close` is recreated every render; including it would tear down and re-add this listener on every keystroke instead of only when `open` flips.
  }, [open])

  // Keeps the highlighted row in view when the arrows walk past the fold, and
  // when a new query changes which command sits at the same index — a
  // wheel-scroll away from the highlighted row followed by a keystroke would
  // otherwise leave the selection off-screen, since `highlighted` itself may
  // not have changed.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [highlighted, flatOrder])

  if (!open) {
    return null
  }

  /**
   * Portalled to `document.body` rather than rendered in place. This
   * component mounts through the `InFrontOfTheCanvas` zone, which lives
   * inside `.tl-canvas__in-front` — a fixed layer that is its own stacking
   * context, pinned at `--tl-layer-canvas-in-front: 250`
   * (`node_modules/tldraw/tldraw.css:50,333`). The `editor.menus.addOpenMenu(MENU_ID)`
   * effect above registers this as an open menu, and that registration is what
   * reactively mounts tldraw's own `MenuClickCapture` — a
   * `position:fixed; inset:0` div at the *same* `--tl-layer-menu-click-capture:
   * 250`, rendered after the in-front wrapper in tldraw's `DefaultCanvas`
   * (`tldraw.css:1642,2363-2367`). Equal z-index, later in the DOM: the
   * capture layer wins every hit test inside that stacking context, so
   * without the portal `document.elementFromPoint` over a result row
   * resolves to `tlui-menu-click-capture`, not the row — every click,
   * hover and the click-away overlay's own `onPointerDown` are silently
   * swallowed, and the palette cannot be dismissed or used with a mouse at
   * all. `z-[100001]` on `DIALOG_CLASSES` only means something once this
   * element is measured against the real page rather than scoped inside
   * `.tl-canvas__in-front` — portalling to `document.body` is what makes
   * that comparison valid, putting the dialog above both `MenuClickCapture`
   * (250) and tldraw's `.tlui-layout` panel layer (300). Do not "simplify"
   * this away: `addOpenMenu` must stay (see the effect above, and AGENTS.md
   * §8) because it is the supported way to suppress tldraw's single-key
   * shortcuts, and the portal is what makes keeping it safe.
   */
  return createPortal(
    <>
      {/* Click-away. Not `pointer-events-none` — a click outside should dismiss
          rather than reach the canvas and place something by accident. */}
      <div
        className="pointer-events-auto fixed inset-0 z-[100000] bg-black/20"
        onPointerDown={close}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Insert"
        onKeyDown={onKeyDown}
        className={DIALOG_CLASSES}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />

          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search shapes, tools and icons..."
            aria-label="Search shapes, tools and icons"
            // The combobox/listbox/activedescendant triple is the pairing
            // assistive tech expects for a type-to-filter list — `aria-expanded`
            // and `aria-controls` were missing before, leaving `aria-activedescendant`
            // without the context that makes it meaningful.
            role="combobox"
            aria-expanded={flatOrder.length > 0}
            aria-controls={flatOrder.length > 0 ? LISTBOX_ID : undefined}
            aria-activedescendant={flatOrder[highlighted] ? `command-${flatOrder[highlighted].id}` : undefined}
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <p aria-live="polite" className="sr-only">
          {total} {total === 1 ? "result" : "results"} found
        </p>

        {flatOrder.length > 0
          ? (
            <div
              ref={listRef}
              id={LISTBOX_ID}
              role="listbox"
              aria-label="Command palette results"
              className="mt-2 max-h-96 overflow-y-auto"
            >
              {SECTIONS.map(section => {
                const rows = results.filter(command => command.sectionId === section.id)

                if (rows.length === 0) {
                  return null
                }

                return (
                  // `role="presentation"` keeps this wrapper out of the a11y
                  // tree, so `listbox` → `option` ownership survives the
                  // section grouping instead of the wrapper `div` breaking it.
                  <div key={section.id} role="presentation">
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>

                    {rows.map(command => {
                      const index = indexByCommandId.get(command.id) ?? -1
                      const isHighlighted = index === highlighted

                      return (
                        <button
                          key={command.id}
                          id={`command-${command.id}`}
                          type="button"
                          role="option"
                          aria-selected={isHighlighted}
                          // Keyboard is arrow-driven and `onKeyDown` traps Tab
                          // on the dialog — these rows must stay out of the tab
                          // order entirely, or Tab lands here with no focus
                          // ring and no handler, and the palette goes dead.
                          tabIndex={-1}
                          data-index={index}
                          onClick={() => run(command)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            // `bg-accent`/`text-accent-foreground` is the same
                            // pairing `MENU_ITEM` (`components/ui/menu.ts`) uses
                            // for its hover state — matching it here rather than
                            // the plain `text-foreground` this used to carry.
                            isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          {command.iconUrl
                            ? (
                              // eslint-disable-next-line @next/next/no-img-element -- static same-origin SVG; the Next optimizer cannot process SVG.
                              <img src={command.iconUrl} alt="" loading="lazy" className="size-5 shrink-0"/>
                            )
                            : command.toolIcon
                              ? <TldrawUiIcon icon={command.toolIcon} label="" className="size-5 shrink-0"/>
                              : <span className="size-5 shrink-0"/>}

                          <span className="truncate">{command.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
          : (
            <p className="mt-3 px-1 pb-2 text-center text-xs text-muted-foreground">
              Nothing matches <span className="font-medium text-foreground">{query}</span>.
            </p>
          )}

        {total > results.length && (
          <p className="mt-2 border-t border-border px-1 pt-2 text-[10px] text-muted-foreground">
            Showing {results.length} of {total}. Keep typing to narrow.
          </p>
        )}
      </div>
    </>,
    document.body,
  )
}

export default CommandPalette
