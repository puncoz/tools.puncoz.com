import type { FunctionComponent } from "react"
import { clientConfig } from "@/config/client"
import { TOOLS } from "@/lib/tools"

/**
 * JSON-LD for the landing page.
 *
 * Two nodes in one graph: the site itself, and the toolbox as an application.
 * `SoftwareApplication` is the honest type — this is a set of tools you sign in
 * to, not an article or a product for sale — and `offers` at zero is how you say
 * "free" in a way a crawler understands, rather than leaving price unstated and
 * looking like an omission.
 *
 * Derived from the tool registry, so a new tool appears here without an edit.
 * Only live ones: advertising something that answers "soon" is the sort of
 * detail that gets structured data ignored.
 *
 * Rendered as a raw script tag because that is the only way JSON-LD exists.
 * `JSON.stringify` output is safe here — every value comes from checked-in
 * config, not from user input — but the `<` escape below keeps it that way if
 * that ever stops being true.
 */
const StructuredData: FunctionComponent = () => {
  const live = TOOLS.filter(tool => tool.status === "live")

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${clientConfig.app.url}/#website`,
        url: clientConfig.app.url,
        name: clientConfig.app.name,
        description: clientConfig.app.description,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${clientConfig.app.url}/#app`,
        name: clientConfig.app.name,
        url: clientConfig.app.url,
        applicationCategory: "DesignApplication",
        operatingSystem: "Any",
        description: clientConfig.app.description,
        featureList: live.map(tool => `${tool.name} — ${tool.description}`),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        isPartOf: { "@id": `${clientConfig.app.url}/#website` },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  )
}

export default StructuredData
