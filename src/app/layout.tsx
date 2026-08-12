import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import React, { type FunctionComponent } from "react"
import { clientConfig } from "@/config/client"
import "@/assets/css/main.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: clientConfig.app.name,
  description: clientConfig.app.description,
}

type Props = Readonly<{
  children: React.ReactNode
}>

const RootLayout: FunctionComponent<Props> = ({ children }) => {
  return (
    <html lang="en">
    <body className={`${inter.variable}`}>
    <AuthKitProvider>
      <main>
        {children}
      </main>
    </AuthKitProvider>

    <SpeedInsights/>
    <Analytics/>
    </body>
    </html>
  )
}

export default RootLayout
