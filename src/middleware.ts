import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const url = req.nextUrl
  
  // Get hostname (e.g. 'voxaiagents.com', 'dashboard.client.com', 'localhost:3000')
  const hostname = req.headers.get('host') || ''
  
  // Define our primary domains that SHOULD see the marketing landing page
  const isPrimaryDomain = 
    hostname.includes('voxaiagents.com') || 
    hostname.includes('localhost') || 
    hostname.includes('vercel.app') // Vercel staging domains

  // If someone visits the root '/' on a CUSTOM white-label domain
  if (!isPrimaryDomain && url.pathname === '/') {
    // Redirect them straight to the login page so they don't see the marketing site
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  return NextResponse.next()
}

// Only run middleware on the root path and main pages, ignore static files and API
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}