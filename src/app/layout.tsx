import type { Metadata } from "next"
import { Inter } from "next/font/google"
import React, { type FunctionComponent } from "react"
import "@/assets/css/main.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "Tools | Puncoz Nepal",
  description: "Some useful tools for developers.",
}

type Props = Readonly<{
  children: React.ReactNode
}>

const RootLayout: FunctionComponent<Props> = ({ children }) => {
  return (
    <html lang="en">
    <body className={`${inter.variable} font-sans antialiased`}>
    <main>
      {children}
    </main>
    </body>
    </html>
  )
}

export default RootLayout
