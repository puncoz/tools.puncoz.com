import { AwsIconShapeUtil } from "@/components/tools/draw/shapes/aws-icon-shape-util"

/**
 * Custom shape utils, registered by EVERY store that loads a drawing.
 *
 * A store's schema is built from the utils registered with it, so a document
 * containing a shape type the store does not know about will not load. Both
 * canvases therefore import this one array — for `createTLStore` and for the
 * `<Tldraw>` prop:
 *
 *   - `components/tools/draw-canvas.tsx`        (owner, editable)
 *   - `components/tools/draw/shared-canvas.tsx` (public share link, read-only)
 *
 * If they ever drift, a diagram containing AWS icons loads fine for its author
 * and fails for everyone holding the share link — a bug that only ever appears
 * on someone else's screen.
 */
const customShapeUtils = [AwsIconShapeUtil]

export { customShapeUtils }
