import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin, supabaseAdmin, getOrgId } from '@/lib/supabase'

// n8n campaign trigger webhook — handles pacing, batching (2 at a time), wallet checks, and completion
const N8N_CAMPAIGN_WEBHOOK = 'https://resplendent-rejoicing-production-4b92.up.railway.app/webhook/trigger-voice-campaign'

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!supabaseVoiceAdmin) {
      return NextResponse.json({ error: 'Voice service is not configured' }, { status: 501 })
    }

    const { campaignId } = await req.json()
    if (!campaignId) {
      return NextResponse.json({ error: 'Missing required parameter: campaignId' }, { status: 400 })
    }

    // Get voice_org_id linked to this dashboard org
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('voice_org_id')
      .eq('id', orgId)
      .single()

    if (orgError || !orgData?.voice_org_id) {
      return NextResponse.json({ error: 'Voice service is not linked for this organization' }, { status: 404 })
    }
    const voiceOrgId = orgData.voice_org_id

    // Verify campaign belongs to this org
    const { data: campaign, error: campError } = await supabaseVoiceAdmin
      .from('campaigns')
      .select('id, name, agent_id, status')
      .eq('id', campaignId)
      .eq('organization_id', voiceOrgId)
      .single()

    if (campError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 })
    }

    // Fetch all pending contacts for this campaign
    const { data: contacts, error: contactsError } = await supabaseVoiceAdmin
      .from('campaign_contacts')
      .select('id, phone_number, name')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    if (contactsError) throw contactsError

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'No pending contacts found in this campaign' }, { status: 400 })
    }

    // Mark campaign as running
    await supabaseVoiceAdmin
      .from('campaigns')
      .update({ status: 'running' })
      .eq('id', campaignId)

    console.log(`[API/Voice/Campaigns/Start] Triggering n8n for campaign ${campaignId} with ${contacts.length} contacts`)

    // POST to n8n — it handles pacing (2 calls at a time, 13s delay) + wallet check + completion
    const n8nResponse = await fetch(N8N_CAMPAIGN_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: campaignId,
        agent_id: campaign.agent_id,
        contacts: contacts.map(c => ({
          id: c.id,
          name: c.name || 'Contact',
          phone_number: c.phone_number
        }))
      })
    })

    if (!n8nResponse.ok) {
      const errText = await n8nResponse.text().catch(() => '')
      console.error(`[API/Voice/Campaigns/Start] n8n webhook error ${n8nResponse.status}: ${errText}`)
      // Revert status back to draft on failure
      await supabaseVoiceAdmin
        .from('campaigns')
        .update({ status: 'draft' })
        .eq('id', campaignId)
      return NextResponse.json(
        { error: `Failed to start campaign: n8n returned ${n8nResponse.status}. ${errText}` },
        { status: 502 }
      )
    }

    console.log(`[API/Voice/Campaigns/Start] Campaign ${campaignId} successfully handed off to n8n`)

    return NextResponse.json({
      success: true,
      message: `Campaign started. ${contacts.length} contacts queued for calling.`,
      total: contacts.length
    })
  } catch (err: any) {
    const error = err?.message || err?.details || String(err) || 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
