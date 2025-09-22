import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Studio Collaboration Platform",
  description: "Real-time collaboration platform for illustrators and clients",
  keywords: ["collaboration", "illustration", "storyboard", "real-time", "creative"],
  authors: [{ name: "Studio Team" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen antialiased`}>
        {children}
        <Toaster />
        <SonnerToaster position="top-right" />
      </body>
    </html>
  )
}