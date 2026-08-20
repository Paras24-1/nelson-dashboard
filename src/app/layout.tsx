import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import OrgProvider from '@/contexts/OrgContext'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  let host = headersList.get('x-forwarded-host') || headersList.get('host') || ''
  
  // Clean the host (remove port, http://, etc.)
  host = host.replace('https://', '').replace('http://', '').split(':')[0]
  
  // Default metadata
  let title = 'VOX AI — Intelligent WhatsApp AI Agents'
  let description = 'VOX AI builds intelligent WhatsApp AI agents that qualify leads, automate bookings, drive sales, and support customers 24/7.'
  let icon = '/vox_ai_favicon.svg'

  try {
    // Look up custom domain in organizations
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('brand_title')
      .ilike('custom_domain', `%${host}%`) // use ilike to be forgiving
      .maybeSingle()
      
    if (org && org.brand_title) {
      title = org.brand_title
      // If we add custom favicon support later, we can set icon = org.favicon_url here
    }
  } catch (err) {
    console.error('Failed to fetch metadata for domain', host, err)
  }

  return {
    title,
    description,
    icons: {
      icon,
    },
  }
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
