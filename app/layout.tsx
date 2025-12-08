import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Vision Academy",
  description: "Professional trading platform and crypto academy",
  generator: "v0.app",
  manifest: "/manifest.json",
  keywords: ["trading", "crypto", "finance", "investment", "academy", "education"],
  authors: [{ name: "Vision Academy" }],
  creator: "Vision Academy",
  publisher: "Vision Academy",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/logo-vision.png",
    shortcut: "/logo-vision.png",
    apple: "/logo-vision.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vision",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#021e73" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Vision" />
        <link rel="apple-touch-icon" href="/logo-vision.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/logo-vision.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/logo-vision.png" />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
