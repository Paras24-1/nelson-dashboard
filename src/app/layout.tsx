import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { OrgProvider } from '@/contexts/OrgContext'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VOX AI — Intelligent WhatsApp AI Agents',
  description: 'VOX AI builds intelligent WhatsApp AI agents that qualify leads, automate bookings, drive sales, and support customers 24/7.',
  icons: {
    icon: '/vox_ai_favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <OrgProvider>
            {children}
          </OrgProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
