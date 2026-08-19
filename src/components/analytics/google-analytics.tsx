import Script from "next/script"
import type { FunctionComponent } from "react"
import ConsentBanner from "@/components/analytics/consent-banner"
import WebVitals from "@/components/analytics/web-vitals"
import { clientConfig } from "@/config/client"
import { consentScript } from "@/lib/ui/consent"

/**
 * Google Analytics 4, behind Consent Mode v2.
 *
 * Renders nothing at all when no measurement id is configured — which is the
 * normal state locally and in any fork — so development never pollutes the
 * property and a checkout without the variable is not silently half-wired.
 *
 * Three pieces have to load in this order:
 *
 * 1. The inline bootstrap, which defines `dataLayer`/`gtag` and sets the consent
 *    defaults. It is a raw blocking `<script>` rather than `next/script`,
 *    because `consent default` only counts if it runs before gtag.js reads
 *    `dataLayer` — and every `next/script` strategy other than
 *    `beforeInteractive` is too late by definition.
 * 2. gtag.js itself, `afterInteractive` — it is not needed for first paint.
 * 3. The `config` call, which sends the first pageview.
 *
 * The consent banner and the Web Vitals reporter live here rather than in the
 * layout so they cannot outlive the thing they exist to serve: no measurement
 * id means no banner asking about cookies that would never be set.
 */
const GoogleAnalytics: FunctionComponent = () => {
  const id = clientConfig.analytics.googleAnalyticsId

  if (!id) {
    return null
  }

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: consentScript }}/>

      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
        strategy="afterInteractive"
      />

      <Script id="ga-config" strategy="afterInteractive">
        {`gtag("js", new Date());gtag("config", ${JSON.stringify(id)});`}
      </Script>

      <WebVitals/>

      <ConsentBanner/>
    </>
  )
}

export default GoogleAnalytics
