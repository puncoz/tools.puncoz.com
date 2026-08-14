"use client"

import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
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
  type TLResizeInfo,
  type TLRichText,
  type TLShape,
  useEditor,
  useIsEditing,
  useValue,
} from "tldraw"
import { awsIconUrl } from "@/lib/aws-icons"

const AWS_ICON_TYPE = "aws-icon"

/**
 * tldraw 5 registers a custom shape's props through module augmentation rather
 * than the generic parameter earlier versions used.
 *
 * The caption is `richText` rather than a plain string, and that is load-bearing
 * rather than decorative — see the note on `canEdit` below.
 */
declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    [AWS_ICON_TYPE]: {
      w: number
      h: number
      service: string
      richText: TLRichText
    }
  }
}

type AwsIconShape = TLShape<typeof AWS_ICON_TYPE>

const DEFAULT_WIDTH = 80
const LABEL_HEIGHT = 26
const DEFAULT_HEIGHT = DEFAULT_WIDTH + LABEL_HEIGHT

const versions = createShapePropsMigrationIds(AWS_ICON_TYPE, {
  initial: 1,
  richTextLabel: 2,
})

/**
 * Icon markup, cached per slug.
 *
 * Exports inline the SVG source rather than referencing it by URL, so a diagram
 * with forty icons performs a handful of fetches instead of forty — and repeated
 * exports (every thumbnail capture is one) reuse the same cache.
 */
const iconSourceCache = new Map<string, Promise<string | null>>()

const loadIconSource = (service: string): Promise<string | null> => {
  const cached = iconSourceCache.get(service)

  if (cached) {
    return cached
  }

  const pending = fetch(awsIconUrl(service))
    .then(response => response.ok ? response.text() : null)
    .catch(() => null)

  iconSourceCache.set(service, pending)

  return pending
}

/** Strips the outer `<svg>` wrapper so the contents can be placed in a group. */
const innerSvg = (source: string): { inner: string, viewBox: string } => {
  const viewBox = /viewBox="([^"]+)"/.exec(source)?.[1] ?? "0 0 64 64"
  const inner = source.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")

  return { inner, viewBox }
}

const AwsIconComponent = ({ shape }: { shape: AwsIconShape }) => {
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
        src={awsIconUrl(shape.props.service)}
        alt=""
        draggable={false}
        style={{ width: "100%", height: iconSize, objectFit: "contain" }}
      />

      <div style={{ position: "relative", width: "100%", height: LABEL_HEIGHT }}>
        <RichTextLabel
          shapeId={shape.id}
          type={AWS_ICON_TYPE}
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
 * An AWS service icon with a caption, moving and resizing as one unit.
 *
 * The icon itself is a static same-origin SVG under `/aws-icons/`, copied out of
 * the `aws-icons` dependency at build time. Nothing is stored per user and
 * nothing is embedded in the document, so a shape costs a couple of hundred
 * bytes and renders on the public share page with no signed-URL round trip.
 */
class AwsIconShapeUtil extends ShapeUtil<AwsIconShape> {
  static override type = AWS_ICON_TYPE

  static override props = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    service: T.string,
    richText: richTextValidator,
  }

  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      { id: versions.initial, up: props => props },
      {
        // The caption started as a plain `label` string and an input of our own.
        // That input could never hold focus — tldraw refocuses its canvas when
        // editing begins — and `canEdit` without `richText` crashed the editor
        // outright. Both problems were the same mistake, so the caption became
        // real rich text and any shape saved under version 1 is carried across.
        id: versions.richTextLabel,
        up: (props: Record<string, unknown>) => {
          props.richText = toRichText(typeof props.label === "string" ? props.label : "")
          delete props.label
        },
      },
    ],
  })

  override getDefaultProps(): AwsIconShape["props"] {
    return {
      w: DEFAULT_WIDTH,
      h: DEFAULT_HEIGHT,
      service: "",
      richText: toRichText(""),
    }
  }

  override getGeometry(shape: AwsIconShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override canResize() {
    return true
  }

  override onResize(shape: AwsIconShape, info: TLResizeInfo<AwsIconShape>) {
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

  override component(shape: AwsIconShape) {
    return <AwsIconComponent shape={shape}/>
  }

  override getIndicatorPath(shape: AwsIconShape) {
    const path = new Path2D()

    path.rect(0, 0, shape.props.w, shape.props.h)

    return path
  }

  /**
   * Canvas rendering is React; exports are not. Without this the icons would be
   * missing from every thumbnail and PNG export and nothing would raise an
   * error — the failure is silent, which is why it is implemented up front.
   */
  override async toSvg(shape: AwsIconShape, ctx: SvgExportContext) {
    const source = await loadIconSource(shape.props.service)
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

export { AWS_ICON_TYPE, AwsIconShapeUtil, DEFAULT_HEIGHT, DEFAULT_WIDTH }
export type { AwsIconShape }
