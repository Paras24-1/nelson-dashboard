import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'Missing parameter: url' }, { status: 400 })
    }

    // SSRF protection: only allow streaming from Vobiz media storage domain
    if (!url.startsWith('https://media.vobiz.ai/')) {
      return NextResponse.json({ error: 'Invalid media URL domain' }, { status: 400 })
    }

    console.log(`[API/Voice/Recordings/Play] Proxying: ${url}`)

    // Forward Range header from browser so audio scrubbing works
    const rangeHeader = req.headers.get('range')

    // Fetch the call recording from Vobiz with credentials
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-ID': 'MA_937EKWJ9',
        'X-Auth-Token': 'rxkkt1fCSffzmiXybX0aN3BoD229NrKuSLa10IXQ3qGIhCW6PtigpByD6kmZZAoh',
        ...(rangeHeader ? { Range: rangeHeader } : {})
      }
    })

    if (!response.ok && response.status !== 206) {
      const errText = await response.text().catch(() => '')
      console.error(`[API/Voice/Recordings/Play] Vobiz error ${response.status}: ${errText}`)
      return NextResponse.json(
        { error: `Vobiz server returned ${response.status}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    const contentLength = response.headers.get('content-length')
    const contentRange = response.headers.get('content-range')
    const acceptRanges = response.headers.get('accept-ranges') || 'bytes'

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      'Cache-Control': 'no-store',
      // Allow browser audio player to work cross-origin
      'Access-Control-Allow-Origin': '*',
    }

    if (contentLength) responseHeaders['Content-Length'] = contentLength
    if (contentRange) responseHeaders['Content-Range'] = contentRange

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    })
  } catch (err: any) {
    console.error('[API/Voice/Recordings/Play] Proxy error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
