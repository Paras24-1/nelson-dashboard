import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin, supabaseAdmin, getOrgId } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  console.log('[API/Voice/TestCall] POST request received');
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!supabaseVoiceAdmin) {
      return NextResponse.json({ error: 'Voice service is not configured' }, { status: 501 })
    }

    const { agentId, phoneNumber } = await req.json()
    if (!agentId || !phoneNumber) {
      return NextResponse.json({ error: 'Missing required parameters: agentId, phoneNumber' }, { status: 400 })
    }

    // Clean phone number (prefix with 91 for Indian numbers if 10 digits)
    let cleanPhone = String(phoneNumber).replace(/\D/g, '')
    if (cleanPhone.length === 10 && /^[6789]/.test(cleanPhone)) {
      cleanPhone = '91' + cleanPhone
    }

    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    // Retrieve mapped voice_org_id
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('voice_org_id')
      .eq('id', orgId)
      .single()

    if (orgError || !orgData?.voice_org_id) {
      return NextResponse.json({ error: 'Voice service is not linked for this organization' }, { status: 404 })
    }
    const voiceOrgId = orgData.voice_org_id

    // 1. Create a one-off test campaign in Voice SaaS DB (Account B)
    const { data: campaign, error: campErr } = await supabaseVoiceAdmin
      .from('campaigns')
      .insert({
        name: `Test Call - ${cleanPhone}`,
        agent_id: agentId,
        organization_id: voiceOrgId,
        status: 'draft'
      })
      .select()
      .single()

    if (campErr) throw campErr

    // 2. Insert the test contact associated with this campaign
    const { error: contactsErr } = await supabaseVoiceAdmin
      .from('campaign_contacts')
      .insert({
        campaign_id: campaign.id,
        name: 'Test Number',
        phone_number: cleanPhone,
        status: 'pending'
      })

    if (contactsErr) throw contactsErr

    // 3. Trigger calling via the Dialer Gateway
    let gatewayUrl = process.env.GATEWAY_URL
    if (!gatewayUrl && process.env.NEXT_PUBLIC_WS_URL) {
      gatewayUrl = process.env.NEXT_PUBLIC_WS_URL
        .replace(/^ws/, 'http')
        .replace('/webRTC-stream', '')
    }

    const urlsToTry = gatewayUrl
      ? [gatewayUrl]
      : ['http://localhost:5050', 'http://localhost:8080']

    let lastError: any = null
    let response: Response | null = null

    for (const url of urlsToTry) {
      try {
        console.log(`[API/Voice/TestCall] Triggering test call on: ${url}/api/campaigns/start`)
        response = await fetch(`${url}/api/campaigns/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: campaign.id })
        })
        if (response.ok) break
      } catch (err) {
        lastError = err
      }
    }

    if (!response || !response.ok) {
      console.error('[API/Voice/TestCall] Dialer gateway failed to start test call:', lastError)
      return NextResponse.json(
        { error: `Dialer gateway connection failed. Error: ${lastError?.message || 'Response not OK'}` },
        { status: 502 }
      )
    }

    const data = await response.json()
    console.log('[API/Voice/TestCall] Successfully initiated outbound call:', data)
    return NextResponse.json({ success: true, campaignId: campaign.id, data })
  } catch (err: any) {
    const error = err?.message || err?.details || String(err) || 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
