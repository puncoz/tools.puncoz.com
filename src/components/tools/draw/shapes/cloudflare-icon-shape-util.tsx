"use client"

import {
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  type TLRichText,
} from "tldraw"
import {
  ICON_SHAPE_PROPS,
  IconShapeUtil,
} from "@/components/tools/draw/shapes/icon-shape-util"
import { cloudflareIconUrl } from "@/lib/cloudflare-icons"

const CLOUDFLARE_ICON_TYPE = "cloudflare-icon"

/**
 * Same module augmentation as the AWS shape, and for the same reason: tldraw 5
 * wants the type as a literal, so each set declares its own.
 */
declare module "tldraw" {
  export interface TLGlobalShapePropsMap {
    [CLOUDFLARE_ICON_TYPE]: {
      w: number
      h: number
      service: string
      richText: TLRichText
    }
  }
}

/**
 * One version, and no legacy step.
 *
 * The AWS shape carries a v1→v2 migration because its caption was once a plain
 * string. This type was born with rich text, so there is nothing to carry across
 * and inventing a matching sequence would only claim a history it never had.
 */
const versions = createShapePropsMigrationIds(CLOUDFLARE_ICON_TYPE, {
  initial: 1,
})

/**
 * A Cloudflare product icon. Everything but the artwork's location is inherited.
 *
 * The artwork is monochrome upstream and is rendered in Cloudflare's orange at
 * build time, so nothing here has to colour it — see
 * `scripts/build-cloudflare-icons.tsx`.
 */
class CloudflareIconShapeUtil extends IconShapeUtil {
  static override type = CLOUDFLARE_ICON_TYPE

  static override props = ICON_SHAPE_PROPS

  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      { id: versions.initial, up: props => props },
    ],
  })

  protected override iconUrl(slug: string): string {
    return cloudflareIconUrl(slug)
  }
}

export { CLOUDFLARE_ICON_TYPE, CloudflareIconShapeUtil }
