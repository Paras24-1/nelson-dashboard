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
    const { data: contact, error: contactsErr } = await supabaseVoiceAdmin
      .from('campaign_contacts')
      .insert({
        campaign_id: campaign.id,
        name: 'Test Call',
        phone_number: cleanPhone,
        status: 'pending'
      })
      .select()
      .single()

    if (contactsErr) throw contactsErr

    // 3. Trigger calling via the Voice Aura Production Dialer Gateway
    const triggerUrl = 'https://voice-aura-production.up.railway.app/api/calls/trigger'
    
    console.log(`[API/Voice/TestCall] Sending POST to ${triggerUrl} for contact ${contact.id}`)
    
    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: cleanPhone,
        name: 'Test Call',
        agentId: agentId,
        contactId: contact.id
      })
    })

    if (!response.ok) {
      const responseText = await response.text().catch(() => '')
      console.error('[API/Voice/TestCall] Dialer gateway returned error status:', response.status, responseText)
      return NextResponse.json(
        { error: `Dialer server returned error ${response.status}: ${responseText || 'No details'}` },
        { status: 502 }
      )
    }

    const data = await response.json().catch(() => ({ success: true }))
    console.log('[API/Voice/TestCall] Successfully triggered call:', data)
    return NextResponse.json({ success: true, campaignId: campaign.id, data })
  } catch (err: any) {
    const error = err?.message || err?.details || String(err) || 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
