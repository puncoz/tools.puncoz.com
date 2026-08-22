"use client"

import { AWS_ICON_TYPE } from "@/components/tools/draw/shapes/aws-icon-shape-util"
import { CLOUDFLARE_ICON_TYPE } from "@/components/tools/draw/shapes/cloudflare-icon-shape-util"
import type { AnyIconShape } from "@/components/tools/draw/shapes/icon-shape-util"

/**
 * Which shape type each icon set inserts.
 *
 * Lives here rather than in `lib/icon-sets.ts` for the reason that file already
 * records: a set descriptor is data and must not reach into `components/`. Two
 * consumers now need the pairing — the dropdowns and the command palette — so it
 * is stated once instead of being passed in from each mount site.
 *
 * Keyed by `IconSet["id"]`. A set added to `lib/icon-sets.ts` without an entry
 * here is inert in the palette rather than broken, which is the failure mode to
 * prefer: nothing throws, the icons simply do not appear.
 */
const SHAPE_TYPE_BY_SET_ID: Record<string, AnyIconShape["type"]> = {
  aws: AWS_ICON_TYPE,
  cloudflare: CLOUDFLARE_ICON_TYPE,
}

export { SHAPE_TYPE_BY_SET_ID }
