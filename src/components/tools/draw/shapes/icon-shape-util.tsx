"use client"

import {
  HTMLContainer,
  Rectangle2d,
  renderPlaintextFromRichText,
  resizeBox,
  RichTextLabel,
  richTextValidator,
  ShapeUtil,
  T,
  toRichText,
  type SvgExportContext,
  type TLGlobalShapePropsMap,
  type TLResizeInfo,
  type TLRichText,
  type TLShape,
  useEditor,
  useIsEditing,
  useValue,
} from "tldraw"

/**
 * The shared implementation behind every provider icon shape.
 *
 * Exactly one thing differs between an AWS icon and a Cloudflare one: where the
 * artwork is served from. Everything else — geometry, resizing, the rich-text
 * caption, and the export path — is identical, and two of those carry hazards
 * that were expensive to find and are invisible when broken (see `canEdit` and
 * `toSvg` below). Copying this file per provider would copy those, and copies
 * drift; drift here has a documented failure mode where a diagram works for its
 * author and breaks for everyone holding the share link.
 *
 * So subclasses supply a type string, the validators, a migration sequence and a
 * URL, and inherit the rest. See `docs/adr/0003-cloudflare-icons.md`.
 */

type IconShapeProps = {
  w: number
  h: number
  service: string
  richText: TLRichText
}

/**
 * Every registered shape type whose props are icon props — derived from tldraw's
 * augmented map rather than listed, so a new set is picked up by declaring itself
 * and nothing here needs editing.
 *
 * Intersecting `TLShape` with the props instead (`TLShape & { props: … }`) does
 * not work: the intersection distributes over the union, so `TLArrowShape &
 * { props: IconShapeProps }` satisfies it and `resizeBox` then rejects the shape
 * for not being a box. `service` is unique to these props, so no built-in type
 * can match by accident.
 */
type IconShapeType = {
  [K in keyof TLGlobalShapePropsMap]: TLGlobalShapePropsMap[K] extends IconShapeProps ? K : never
}[keyof TLGlobalShapePropsMap]

/** Any shape carrying icon props, whatever its type string. */
type AnyIconShape = TLShape<IconShapeType>

const DEFAULT_WIDTH = 80
const LABEL_HEIGHT = 26
const DEFAULT_HEIGHT = DEFAULT_WIDTH + LABEL_HEIGHT

/** Identical for every set, so the validators are declared once. */
const ICON_SHAPE_PROPS = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  service: T.string,
  richText: richTextValidator,
}

/**
 * Icon markup, cached per URL.
 *
 * Exports inline the SVG source rather than referencing it by URL, so a diagram
 * with forty icons performs a handful of fetches instead of forty — and repeated
 * exports (every thumbnail capture is one) reuse the same cache. Keyed on the
 * full URL rather than the slug, so two sets cannot collide on a shared name.
 */
const iconSourceCache = new Map<string, Promise<string | null>>()

const loadIconSource = (url: string): Promise<string | null> => {
  const cached = iconSourceCache.get(url)

  if (cached) {
    return cached
  }

  const pending = fetch(url)
    .then(response => response.ok ? response.text() : null)
    .catch(() => null)

  iconSourceCache.set(url, pending)

  return pending
}

/** Strips the outer `<svg>` wrapper so the contents can be placed in a group. */
const innerSvg = (source: string): { inner: string, viewBox: string } => {
  const viewBox = /viewBox="([^"]+)"/.exec(source)?.[1] ?? "0 0 64 64"
  const inner = source.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")

  return { inner, viewBox }
}

const IconShapeComponent = ({ shape, url }: { shape: AnyIconShape, url: string }) => {
  const editor = useEditor()
  const isEditing = useIsEditing(shape.id)
  const isSelected = useValue(
    "isSelected",
    () => editor.getOnlySelectedShapeId() === shape.id,
    [editor, shape.id],
  )

  const iconSize = Math.max(shape.props.h - LABEL_HEIGHT, 0)

  return (
    <HTMLContainer
      style={{
        width: shape.props.w,
        height: shape.props.h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: isEditing ? "all" : "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a static same-origin
          SVG; the Next optimizer offers nothing here and cannot process SVG. */}
      <img
        src={url}
        alt=""
        draggable={false}
        style={{ width: "100%", height: iconSize, objectFit: "contain" }}
      />

      <div style={{ position: "relative", width: "100%", height: LABEL_HEIGHT }}>
        <RichTextLabel
          shapeId={shape.id}
          type={shape.type}
          richText={shape.props.richText}
          isSelected={isSelected}
          fontFamily="var(--tl-font-draw)"
          fontSize={12}
          lineHeight={1.2}
          textAlign="center"
          verticalAlign="middle"
          labelColor="var(--color-text)"
          wrap
        />
      </div>
    </HTMLContainer>
  )
}

/**
 * A provider icon with a caption, moving and resizing as one unit.
 *
 * The icon itself is a static same-origin SVG produced at build time. Nothing is
 * stored per user and nothing is embedded in the document, so a shape costs a
 * couple of hundred bytes and renders on the public share page with no signed-URL
 * round trip.
 *
 * Typed over the union of icon shapes rather than generically over one of them.
 * A type parameter reads as the more precise choice and is not: tldraw's own
 * helpers return concrete shapes, so `resizeBox` inside a still-generic class
 * cannot be proven to relate to that class's eventual shape, and the only way
 * through is an assertion. Since tldraw dispatches on the static `type` string,
 * a util never receives a shape belonging to another set, and the union costs
 * nothing at runtime.
 */
abstract class IconShapeUtil extends ShapeUtil<AnyIconShape> {
  /** Where this set's artwork lives. The only provider-specific behaviour. */
  protected abstract iconUrl(slug: string): string

  override getDefaultProps(): AnyIconShape["props"] {
    return {
      w: DEFAULT_WIDTH,
      h: DEFAULT_HEIGHT,
      service: "",
      richText: toRichText(""),
    }
  }

  override getGeometry(shape: AnyIconShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override canResize() {
    return true
  }

  override onResize(shape: AnyIconShape, info: TLResizeInfo<AnyIconShape>) {
    return resizeBox(shape, info)
  }

  /**
   * Editable, and safe to be so *because* the caption is rich text.
   *
   * In tldraw 5, `canEdit() === true` is effectively a promise that the shape has
   * a `richText` prop. `SelectTool` keeps its side of the bargain — it checks
   * `hasRichText` first — but the geo and arrow tools' idle states call
   * `startEditingShapeWithRichText` on a bare `canEditShape` check, and that
   * helper *throws* "Shape does not have rich text" otherwise. With a plain
   * string caption, pressing Enter with an icon selected and the rectangle tool
   * active took down the whole canvas.
   */
  override canEdit() {
    return true
  }

  override component(shape: AnyIconShape) {
    return <IconShapeComponent shape={shape} url={this.iconUrl(shape.props.service)}/>
  }

  override getIndicatorPath(shape: AnyIconShape) {
    const path = new Path2D()

    path.rect(0, 0, shape.props.w, shape.props.h)

    return path
  }

  /**
   * Canvas rendering is React; exports are not. Without this the icons would be
   * missing from every thumbnail and PNG export and nothing would raise an
   * error — the failure is silent, which is why it is implemented up front.
   */
  override async toSvg(shape: AnyIconShape, ctx: SvgExportContext) {
    const source = await loadIconSource(this.iconUrl(shape.props.service))
    const iconSize = Math.max(shape.props.h - LABEL_HEIGHT, 0)
    const label = renderPlaintextFromRichText(this.editor, shape.props.richText)

    return (
      <g>
        {source && (
          <svg
            x={0}
            y={0}
            width={shape.props.w}
            height={iconSize}
            viewBox={innerSvg(source).viewBox}
            preserveAspectRatio="xMidYMid meet"
            // The source is our own build output, not user input.
            dangerouslySetInnerHTML={{ __html: innerSvg(source).inner }}
          />
        )}

        {label && (
          <text
            x={shape.props.w / 2}
            y={iconSize + LABEL_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontFamily="sans-serif"
            fill={ctx.isDarkMode ? "#f5f5f5" : "#1d1d1d"}
          >
            {label}
          </text>
        )}
      </g>
    )
  }
}

export { DEFAULT_HEIGHT, DEFAULT_WIDTH, ICON_SHAPE_PROPS, IconShapeUtil }
export type { AnyIconShape }
