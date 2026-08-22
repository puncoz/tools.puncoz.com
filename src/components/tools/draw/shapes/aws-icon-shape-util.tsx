"use client"

import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  toRichText,
  type TLRichText,
} from "tldraw"
import {
  ICON_SHAPE_PROPS,
  IconShapeUtil,
} from "@/components/tools/draw/shapes/icon-shape-util"
import { awsIconUrl } from "@/lib/aws-icons"

const AWS_ICON_TYPE = "aws-icon"

/**
 * tldraw 5 registers a custom shape's props through module augmentation rather
 * than the generic parameter earlier versions used, so this has to name the type
 * as a literal and cannot be produced by the shared base class.
 *
 * The caption is `richText` rather than a plain string, and that is load-bearing
 * rather than decorative — see the note on `canEdit` in `icon-shape-util.tsx`.
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

const versions = createShapePropsMigrationIds(AWS_ICON_TYPE, {
  initial: 1,
  richTextLabel: 2,
})

/**
 * An AWS service icon. Everything but the artwork's location is inherited.
 *
 * The type string and the migration sequence below are frozen: both are written
 * into every stored shape record, so changing either would fail to load drawings
 * that already exist.
 */
class AwsIconShapeUtil extends IconShapeUtil {
  static override type = AWS_ICON_TYPE

  static override props = ICON_SHAPE_PROPS

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

  protected override iconUrl(slug: string): string {
    return awsIconUrl(slug)
  }
}

export { AWS_ICON_TYPE, AwsIconShapeUtil }
