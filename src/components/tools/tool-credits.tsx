import { Fragment, type FunctionComponent } from "react"
import { TOOLS } from "@/lib/tools"

/**
 * Attribution for the libraries the tools are built on.
 *
 * Rendered below the grid rather than inside the cards on purpose: a live tool
 * card is itself a `<Link>`, and an anchor nested in an anchor is invalid HTML
 * with an ambiguous click target. Out here the credit is a real, working link.
 *
 * Derived from the registry, so crediting a new tool's library is a field on its
 * entry rather than an edit to this file.
 *
 * Renders the credit line only. The `<footer>` around it belongs to
 * `site-footer.tsx`, which also carries the legal links — keeping the shell out
 * here is what stops this file from slowly becoming "everything at the bottom
 * of the page".
 */
const ToolCredits: FunctionComponent = () => {
  // flatMap rather than filter so the optional `builtWith` narrows to defined.
  const credits = TOOLS.flatMap(tool =>
    tool.builtWith ? [{ slug: tool.slug, name: tool.name, builtWith: tool.builtWith }] : [],
  )

  if (credits.length === 0) {
    return null
  }

  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {credits.map(credit => (
        <Fragment key={credit.slug}>
          {credit.name} is built with{" "}
          <a
            href={credit.builtWith.href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {credit.builtWith.name}
          </a>
          .{" "}
        </Fragment>
      ))}
    </p>
  )
}

export default ToolCredits
