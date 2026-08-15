import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin, supabaseAdmin, getOrgId } from '@/lib/supabase'

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
    let voiceOrgId: string | null = null

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('voice_org_id')
      .eq('id', orgId)
      .single()

    if (orgError || !orgData?.voice_org_id) {
      return NextResponse.json({ error: 'Voice service is not linked for this organization' }, { status: 404 })
    }
    voiceOrgId = orgData.voice_org_id

    // Retrieve the actual wallet balance from the Voice Supabase database (Account B)
    let voiceWalletCredits = 0.00
    const { data: voiceOrgData, error: voiceOrgError } = await supabaseVoiceAdmin
      .from('organizations')
      .select('wallet_balance')
      .eq('id', voiceOrgId)
      .single()

    if (voiceOrgError) {
      console.warn('[API/Voice/Campaigns/Start] Failed to fetch wallet balance from Voice Supabase:', voiceOrgError.message)
    } else {
      voiceWalletCredits = voiceOrgData?.wallet_balance ? Number(voiceOrgData.wallet_balance) : 0.00
    }

    // 2. Fetch total calling minutes to calculate wallet state
    const { data: allBilling, error: billingError } = await supabaseVoiceAdmin
      .from('call_logs')
      .select('duration_seconds')
      .eq('organization_id', voiceOrgId)

    if (billingError) {
      console.error('[API/Voice/Campaigns/Start] Error fetching logs for billing verification:', billingError)
    } else {
      const billingArr = allBilling || []
      const totalDurationSeconds = billingArr.reduce((sum, l) => sum + (l.duration_seconds || 0), 0)
      const totalMinutes = totalDurationSeconds / 60
      
      const freeMinutesLimit = 100
      const overageMinutes = Math.max(0, totalMinutes - freeMinutesLimit)
      const creditsConsumed = overageMinutes * 3.5
      const remainingBalance = voiceWalletCredits - creditsConsumed

      if (totalMinutes >= freeMinutesLimit && remainingBalance <= 0) {
        return NextResponse.json(
          { error: `Insufficient wallet balance (₹${remainingBalance.toFixed(2)}). You have used ${Math.round(totalMinutes)} mins (100 free limit exceeded). Please top up your wallet to start campaigns.` },
          { status: 402 }
        )
      }
    }

    // 1. Verify that the campaign belongs to this organization
    const { data: campaign, error: campError } = await supabaseVoiceAdmin
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('organization_id', voiceOrgId)
      .single()

    if (campError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 })
    }

    // Determine the gateway API URL from environment variables
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
        console.log(`[API/Voice/Campaigns/Start] Forwarding request to: ${url}/api/campaigns/start`)
        response = await fetch(`${url}/api/campaigns/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId })
        })
        if (response.ok) break
      } catch (err) {
        lastError = err
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: `Dialer gateway connection failed. Error: ${lastError?.message || 'Response not OK'}` },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err: any) {
    const error = err?.message || err?.details || String(err) || 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
