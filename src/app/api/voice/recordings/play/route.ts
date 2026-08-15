import { NextRequest, NextResponse } from 'next/server'
import { getOrgId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'Missing parameter: url' }, { status: 400 })
    }

    // SSRF protection: only allow streaming from Vobiz media storage domain
    if (!url.startsWith('https://media.vobiz.ai/')) {
      return NextResponse.json({ error: 'Invalid media URL domain' }, { status: 400 })
    }

    console.log(`[API/Voice/Recordings/Play] Proxying call recording request for URL: ${url}`)

    // Fetch the call recording from Vobiz using Auth credentials
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-ID': 'MA_937EKWJ9',
        'X-Auth-Token': 'rxkkt1fCSffzmiXybX0aN3BoD229NrKuSLa10IXQ3qGIhCW6PtigpByD6kmZZAoh'
      }
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error(`[API/Voice/Recordings/Play] Vobiz request failed with status: ${response.status}, error: ${errText}`)
      return NextResponse.json(
        { error: `Vobiz server returned ${response.status}: ${errText || 'No details'}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    const contentLength = response.headers.get('content-length')

    // Stream the audio response binary directly back to the client
    const responseHeaders: HeadersInit = {
      'Content-Type': contentType,
      ...(contentLength ? { 'Content-Length': contentLength } : {})
    }

    return new Response(response.body, {
      status: 200,
      headers: responseHeaders
    })
  } catch (err: any) {
    console.error('[API/Voice/Recordings/Play] Proxy error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
