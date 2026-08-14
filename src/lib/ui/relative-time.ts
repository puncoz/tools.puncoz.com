const DIVISIONS: { amount: number, unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
]

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

/**
 * "2 hours ago", "yesterday", "3 months ago".
 *
 * Call this on the server and pass the string down. Formatting it in a client
 * component would compare the server's clock at render time against the browser's
 * at hydration time, and any drift across a boundary — 59 seconds becoming 61 —
 * is a hydration mismatch.
 */
const relativeTime = (date: Date, now: Date = new Date()): string => {
  let duration = (date.getTime() - now.getTime()) / 1000

  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(duration) < amount) {
      return formatter.format(Math.round(duration), unit)
    }

    duration /= amount
  }

  return formatter.format(Math.round(duration), "year")
}

export { relativeTime }
