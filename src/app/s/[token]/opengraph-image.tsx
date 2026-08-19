import { ImageResponse } from "next/og"
import sharp from "sharp"
import { clientConfig } from "@/config/client"
import { getShareThumbnail } from "@/lib/drawings/queries"
import { isShareTokenShaped } from "@/lib/drawings/share"
import { parseThumbnail } from "@/lib/drawings/thumbnail"

/**
 * The card a shared drawing unfurls as in Slack, WhatsApp, Discord and the rest.
 *
 * Composed rather than serving the stored preview directly: thumbnails are
 * whatever shape the drawing is, and platforms centre-crop anything that is not
 * roughly 1.91:1 — so a tall diagram would arrive with its top and bottom cut
 * off. Letterboxing it onto the brand colour keeps the whole drawing visible.
 *
 * Fetched by crawlers, which carry no cookies, so this has no session and cannot
 * have one. The token authenticates it, exactly as it does for the page itself
 * and for `/api/share/[token]/assets/resolve`. That is sound here and nowhere
 * else: the token already grants the entire drawing, so its preview discloses
 * nothing further.
 *
 * `getShareThumbnail` reuses the page's own WHERE clause, so a revoked, trashed
 * or banned-owner drawing falls through to the anonymous card below rather than
 * continuing to render after its link has stopped working.
 *
 * The page stays `noindex, nofollow`. This makes a link previewable in a chat
 * client; it does not make it findable in a search engine, and those are
 * different crawlers reading different signals.
 */

export const size = { width: 1200, height: 630 }

export const contentType = "image/png"

export const alt = `A drawing shared from ${clientConfig.app.name}`

// Reads a live row, and must stop rendering the moment sharing is revoked.
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

const BRAND = "#567F95"

/**
 * The bare host, derived rather than written out again, so the card cannot end
 * up naming a domain the site is no longer served from.
 *
 * The domain rather than the wordmark: a card seen in someone else's Slack is
 * out of context by definition, and "tools.puncoz.com" tells a reader where the
 * link goes — which is the question they actually have.
 */
const HOST = new URL(clientConfig.app.url).host

/**
 * Shown for a dead token, a drawing with no preview yet, and a malformed URL
 * alike — deliberately the same card for all three. An unfurl that failed and an
 * unfurl of a revoked link must not be distinguishable, or the preview becomes a
 * way to test whether a token was ever real.
 */
const fallback = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: BRAND,
      color: "#ffffff",
      fontSize: 72,
      fontWeight: 600,
      letterSpacing: "-0.02em",
    }}
  >
    {clientConfig.app.name}
  </div>
)

/**
 * Re-encodes a stored preview as PNG for Satori, which cannot decode WebP —
 * and WebP is exactly what previews are stored as, because it is a fifth the
 * size and the gallery fetches one per card on a route the AuthKit proxy makes
 * uncacheable. Measured on this database: 5.6 KB as WebP, 26 KB as PNG.
 *
 * So the conversion happens here, once per unfurl, rather than by storing a
 * second format or by making every gallery visit five times heavier for the
 * sake of a card that is fetched when someone pastes a link.
 *
 * `sharp` is safe to depend on: `next` already declares it and it is already
 * installed and locked at this version, so adding it to `package.json` makes an
 * existing module importable rather than adding anything to the install. It is
 * pinned to `next`'s range on purpose — a newer major would put a second copy
 * in the bundle.
 *
 * Returns null on anything unexpected. A card that silently loses its picture
 * beats an unfurl that 500s, and the caller falls back to the plain one.
 */
const toPngDataUrl = async (stored: string): Promise<string | null> => {
  const parsed = parseThumbnail(stored)

  if (!parsed) {
    return null
  }

  const bytes = Buffer.from(parsed.base64, "base64")

  if (parsed.mime === "image/png") {
    return stored
  }

  try {
    const png = await sharp(bytes).png().toBuffer()

    return `data:image/png;base64,${png.toString("base64")}`
  } catch {
    return null
  }
}

const Image = async ({ params }: Props) => {
  const { token } = await params

  const drawing = isShareTokenShaped(token)
    ? await getShareThumbnail(token)
    : undefined

  const preview = drawing?.thumbnail ? await toPngDataUrl(drawing.thumbnail) : null

  if (!drawing || !preview) {
    return new ImageResponse(fallback(), size)
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BRAND,
          padding: 48,
        }}
      >
        {/* `contain` rather than `cover`: the drawing is the content, and
            cropping it to fill the frame would hide the part someone shared. */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ffffff",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {/* A plain <img> with no lint suppression needed: Satori renders this
              JSX to a bitmap rather than to a DOM, so `next/image` has nothing
              to optimise here and the rule does not fire. */}
          <img
            src={preview}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginTop: 28,
            color: "#ffffff",
          }}
        >
          {/* Satori has no line clamping, so a long title is cut by hand. */}
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {drawing.title.length > 46 ? `${drawing.title.slice(0, 45)}…` : drawing.title}
          </div>

          <div style={{ fontSize: 24, opacity: 0.85 }}>
            {HOST}
          </div>
        </div>
      </div>
    ),
    size,
  )
}

export default Image
