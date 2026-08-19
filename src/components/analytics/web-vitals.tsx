"use client"

import { useReportWebVitals } from "next/web-vitals"
import type { FunctionComponent } from "react"

/**
 * Forwards Core Web Vitals to GA4.
 *
 * Vercel Speed Insights already collects these, so this is not the only source —
 * it exists so the numbers sit next to the traffic they belong to, and can be
 * sliced by page, device and referrer in one place rather than two.
 *
 * CLS is reported to three decimal places and everything else to the nearest
 * millisecond, because GA4 event parameters are integers: sending a raw CLS of
 * 0.081 would arrive as 0 and quietly look perfect.
 *
 * Renders nothing. It is mounted by `google-analytics.tsx`, so it only exists on
 * pages where gtag exists — but the optional call below still guards it, since
 * a metric can fire before the tag library has finished loading.
 */
const WebVitals: FunctionComponent = () => {
  useReportWebVitals(metric => {
    window.gtag?.("event", metric.name, {
      value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_rating: metric.rating,
      // Keeps these out of the standard reports, where they would otherwise be
      // counted as engagement and distort session metrics.
      non_interaction: true,
    })
  })

  return null
}

export default WebVitals
