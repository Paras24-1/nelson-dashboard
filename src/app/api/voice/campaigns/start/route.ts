import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin, supabaseAdmin, getOrgId } from '@/lib/supabase'

// n8n campaign trigger webhook base URL
const N8N_BASE_URL = 'https://resplendent-rejoicing-production-4b92.up.railway.app'

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

    // Retrieve mapped voice_org_id from the main database
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('voice_org_id')
      .eq('id', orgId)
      .single()

    if (orgError || !orgData?.voice_org_id) {
      return NextResponse.json({ error: 'Voice service is not linked for this organization' }, { status: 404 })
    }
    const voiceOrgId = orgData.voice_org_id

    // Check wallet balance from Voice Supabase (Account B)
    const { data: voiceOrgData, error: voiceOrgError } = await supabaseVoiceAdmin
      .from('organizations')
      .select('wallet_balance')
      .eq('id', voiceOrgId)
      .single()

    if (!voiceOrgError && voiceOrgData) {
      const voiceWalletCredits = Number(voiceOrgData.wallet_balance) || 0

      const { data: allBilling } = await supabaseVoiceAdmin
        .from('call_logs')
        .select('duration_seconds')
        .eq('organization_id', voiceOrgId)

      if (allBilling) {
        const totalDurationSeconds = allBilling.reduce((sum, l) => sum + (l.duration_seconds || 0), 0)
        const totalMinutes = totalDurationSeconds / 60
        const freeMinutesLimit = 100
        const overageMinutes = Math.max(0, totalMinutes - freeMinutesLimit)
        const creditsConsumed = overageMinutes * 3.5
        const remainingBalance = voiceWalletCredits - creditsConsumed

        if (totalMinutes >= freeMinutesLimit && remainingBalance <= 0) {
          return NextResponse.json(
            { error: `Insufficient wallet balance (₹${remainingBalance.toFixed(2)}). Please top up your wallet to start campaigns.` },
            { status: 402 }
          )
        }
      }
    }

    // Verify campaign belongs to this organization
    const { data: campaign, error: campError } = await supabaseVoiceAdmin
      .from('campaigns')
      .select('id, name, agent_id, status')
      .eq('id', campaignId)
      .eq('organization_id', voiceOrgId)
      .single()

    if (campError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 })
    }

    // Mark campaign as running in Voice DB
    await supabaseVoiceAdmin
      .from('campaigns')
      .update({ status: 'running' })
      .eq('id', campaignId)

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

    // Trigger each contact via voice-aura dialer
    const triggerUrl = 'https://voice-aura-production.up.railway.app/api/calls/trigger'
    let triggered = 0
    let failed = 0

    for (const contact of contacts) {
      try {
        const response = await fetch(triggerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: contact.phone_number,
            name: contact.name || 'Contact',
            agentId: campaign.agent_id,
            contactId: contact.id
          })
        })

        if (response.ok) {
          triggered++
          // Mark contact as in-progress
          await supabaseVoiceAdmin
            .from('campaign_contacts')
            .update({ status: 'in-progress' })
            .eq('id', contact.id)
        } else {
          failed++
          console.warn(`[API/Voice/Campaigns/Start] Failed to trigger contact ${contact.id}: ${response.status}`)
        }
      } catch (err) {
        failed++
        console.warn(`[API/Voice/Campaigns/Start] Error triggering contact ${contact.id}:`, err)
      }
    }

    console.log(`[API/Voice/Campaigns/Start] Campaign ${campaignId}: triggered=${triggered}, failed=${failed}`)

    if (triggered === 0) {
      // Revert to draft if nothing triggered
      await supabaseVoiceAdmin
        .from('campaigns')
        .update({ status: 'draft' })
        .eq('id', campaignId)
      return NextResponse.json(
        { error: `Failed to trigger any contacts. All ${failed} trigger attempts failed.` },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Campaign started. ${triggered} calls triggered${failed > 0 ? `, ${failed} failed` : ''}.`,
      triggered,
      failed
    })
  } catch (err: any) {
    const error = err?.message || err?.details || String(err) || 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
