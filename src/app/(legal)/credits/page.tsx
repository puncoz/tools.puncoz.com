import type { Metadata } from "next"
import type { FunctionComponent } from "react"
import PageShell from "@/components/ui/page-shell"
import { prose } from "@/components/ui/prose"
import { clientConfig } from "@/config/client"
import { CREDITS, sentence } from "@/lib/credits"

/**
 * Attribution for the artwork the site renders.
 *
 * Lives beside the legal pages because it answers to the same kind of obligation:
 * `@cloudflare/component-icon` is BSD-3-Clause and its clause 2 requires the
 * notice to be reproduced in materials provided with the distribution, and
 * generating those icons into `public/` and serving them is a distribution.
 *
 * Every section is derived from `lib/credits.ts`, so a new icon set is credited
 * by adding a record rather than by editing this file — and `IconSet.credit`
 * makes forgetting it impossible. See `docs/adr/0004-attribution.md`.
 */

export const metadata: Metadata = {
  // The wordmark is appended by the root layout's title template.
  title: "Credits",
  description: "The artwork and libraries this site is built from, and the terms they are used under.",
  alternates: { canonical: "/credits" },
}

const CreditsPage: FunctionComponent = () => {
  return (
    <PageShell crumbs={["Credits"]}>
      <article className={prose}>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Credits</h1>

        <p>
          {clientConfig.app.name} draws with artwork it did not make. This page lists that artwork
          and the library the canvas runs on, with the terms each is used under. It covers what the
          site renders to you as pictures — it is not a complete listing of every package the
          project depends on, and does not pretend to be.
        </p>

        {CREDITS.map(credit => (
          // The id is the anchor each icon picker links to, so a person choosing
          // an icon lands on that set rather than at the top of the page.
          <section key={credit.id} id={credit.id} className="scroll-mt-24">
            <h2>
              <a href={credit.href} target="_blank" rel="noreferrer">{credit.name}</a>
            </h2>

            <p>
              {sentence(credit.use)} Rights held by {sentence(credit.holder)}{" "}
              Used under {sentence(credit.license)}
            </p>

            {credit.via && (
              <p>
                Delivered to this project through{" "}
                <a href={credit.via.href} target="_blank" rel="noreferrer">{credit.via.name}</a>,
                {" "}a separate package by {credit.via.author} under {sentence(credit.via.license)} The
                packaging and the artwork are held by different people under different terms, so
                both are named.
              </p>
            )}

            {credit.disclaimer && <p>{credit.disclaimer}</p>}

            {credit.notice && (
              // Reproduced verbatim, which is the whole point — so it is rendered
              // as preformatted text and wrapped rather than reflowed as prose.
              <pre className="mt-4 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
                {credit.notice}
              </pre>
            )}
          </section>
        ))}

        <h2>Something missing or wrong?</h2>

        <p>
          If you hold rights to anything here and the attribution is wrong, or absent, write to{" "}
          <a href={`mailto:${clientConfig.app.contactEmail}`}>{clientConfig.app.contactEmail}</a>
          {" "}and it will be corrected.
        </p>
      </article>
    </PageShell>
  )
}

export default CreditsPage
