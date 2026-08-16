import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin } from '@/lib/supabase'

const VOBIZ_AUTH_ID = 'MA_937EKWJ9'
const VOBIZ_AUTH_TOKEN = 'rxkkt1fCSffzmiXybX0aN3BoD229NrKuSLa10IXQ3qGIhCW6PtigpByD6kmZZAoh'

// This endpoint syncs missing recording URLs from Vobiz API into our DB.
// Called automatically by the voice-aura Railway server callback, or manually.
export async function POST(req: NextRequest) {
  try {
    // Also accept Vobiz direct callback (form or JSON)
    let body: any = {}
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}))
    } else {
      // Vobiz sends as application/x-www-form-urlencoded or multipart
      const formData = await req.text()
      formData.split('&').forEach(pair => {
        const [k, v] = pair.split('=')
        if (k) body[decodeURIComponent(k)] = decodeURIComponent(v || '')
      })
    }

    // If it's a direct Vobiz recording callback — save immediately
    const callUuid = body.call_uuid
    const recordUrl = body.record_url || body.recording_url

    if (callUuid && recordUrl && supabaseVoiceAdmin) {
      console.log(`[API/Voice/Vobiz/Callback] Recording callback for call ${callUuid}: ${recordUrl}`)
      const { error } = await supabaseVoiceAdmin
        .from('call_logs')
        .update({ recording_url: recordUrl })
        .eq('call_sid', callUuid)
      if (error) console.error('[API/Voice/Vobiz/Callback] DB update error:', error.message)
      else console.log('[API/Voice/Vobiz/Callback] ✅ recording_url saved')
      return new NextResponse('OK', { status: 200 })
    }

    // Otherwise do a full sync: fetch all Vobiz recordings and patch missing ones
    if (!supabaseVoiceAdmin) {
      return NextResponse.json({ error: 'Voice service not configured' }, { status: 501 })
    }

    // 1. Fetch all recordings from Vobiz
    const vobizHeaders = {
      'X-Auth-ID': VOBIZ_AUTH_ID,
      'X-Auth-Token': VOBIZ_AUTH_TOKEN
    }
    let allRecordings: any[] = []
    let offset = 0
    const limit = 20
    while (true) {
      const res = await fetch(
        `https://api.vobiz.ai/api/v1/Account/${VOBIZ_AUTH_ID}/Recording/?limit=${limit}&offset=${offset}`,
        { headers: vobizHeaders }
      )
      if (!res.ok) break
      const data = await res.json()
      const objects = data?.objects || []
      allRecordings = allRecordings.concat(objects)
      if (objects.length < limit) break
      offset += limit
    }

    const uuidToUrl: Record<string, string> = {}
    for (const r of allRecordings) {
      if (r.call_uuid && r.recording_url) uuidToUrl[r.call_uuid] = r.recording_url
    }

    // 2. Fetch all DB call logs missing recording_url in pages
    let allLogs: any[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data } = await supabaseVoiceAdmin
        .from('call_logs')
        .select('id, call_sid')
        .is('recording_url', null)
        .not('call_sid', 'is', null)
        .range(from, from + pageSize - 1)
      if (!data || data.length === 0) break
      allLogs = allLogs.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }

    // 3. Match and update
    let updated = 0
    for (const log of allLogs) {
      const url = uuidToUrl[log.call_sid]
      if (url) {
        await supabaseVoiceAdmin
          .from('call_logs')
          .update({ recording_url: url })
          .eq('id', log.id)
        updated++
      }
    }

    return NextResponse.json({
      success: true,
      vobizRecordings: allRecordings.length,
      dbLogsChecked: allLogs.length,
      updated
    })
  } catch (err: any) {
    console.error('[API/Voice/Vobiz/Callback] Error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

export async function GET() {
  return new NextResponse('Vobiz recording sync endpoint — use POST', { status: 200 })
}
