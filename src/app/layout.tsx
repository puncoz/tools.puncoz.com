import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import React, { type FunctionComponent } from "react"
import TopProgressBar from "@/components/ui/top-progress-bar"
import { clientConfig } from "@/config/client"
import { themeScript } from "@/lib/ui/theme"
import "@/assets/css/main.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

export const metadata: Metadata = {
  // Makes the Open Graph and icon URLs below absolute. Without it Next warns and
  // falls back to localhost, which is what then gets shared.
  metadataBase: new URL(clientConfig.app.url),
  title: {
    default: clientConfig.app.name,
    // Pages set a bare title; the wordmark is appended for them.
    template: `%s — ${clientConfig.app.name}`,
  },
  description: clientConfig.app.description,
  applicationName: clientConfig.app.name,
  openGraph: {
    type: "website",
    siteName: clientConfig.app.name,
    title: clientConfig.app.name,
    description: clientConfig.app.description,
    url: "/",
  },
}

export const viewport: Viewport = {
  // Tints the browser chrome on Android and the title bar of an installed PWA.
  // Two entries so the dark palette's background is used there rather than the
  // brand blue, which would band against it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: clientConfig.app.brandColor },
    { media: "(prefers-color-scheme: dark)", color: "#0E1A21" },
  ],
}

type Props = Readonly<{
  children: React.ReactNode
}>

/**
 * `suppressHydrationWarning` is on `<html>` because the theme script below
 * mutates its class list before React hydrates. That is the point of the script
 * — the alternative is a white flash on every load for dark-mode users — and it
 * is the one place where a server/client attribute mismatch is intended.
 *
 * No `<main>` here: each page provides its own, and wrapping them produced
 * nested `<main>` elements, which is invalid and gives assistive technology two
 * competing landmarks.
 */
const RootLayout: FunctionComponent<Props> = ({ children }) => {
  return (
    <html lang="en" suppressHydrationWarning>
    <body className={`${inter.variable}`}>
    {/*
      * First child of `<body>` so it executes before anything below it is
      * parsed, and therefore before the first paint. A `<script src>` or an
      * effect would both land after the page has already been drawn light.
      */}
    <script dangerouslySetInnerHTML={{ __html: themeScript }}/>

    <AuthKitProvider>
      <TopProgressBar/>

      {children}
    </AuthKitProvider>

    <SpeedInsights/>
    <Analytics/>
    </body>
    </html>
  )
}

export default RootLayout
