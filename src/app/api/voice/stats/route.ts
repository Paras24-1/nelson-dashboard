import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin, supabaseAdmin, getOrgId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  console.log('[API/Voice/Stats] GET request received');
  try {
    const orgId = await getOrgId(req)
    console.log('[API/Voice/Stats] Resolved primary orgId:', orgId);
    if (!orgId) {
      console.warn('[API/Voice/Stats] Unauthorized: Failed to resolve orgId from request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseVoiceAdmin) {
      console.warn('[API/Voice/Stats] Service not configured: supabaseVoiceAdmin is null');
      return NextResponse.json({ error: 'Voice service is not configured' }, { status: 501 })
    }

    // Retrieve the mapped Voice SaaS Organization ID and plan from the main database
    let voiceOrgId: string | null = null
    let plan = 'trial'

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('voice_org_id, plan')
      .eq('id', orgId)
      .single()

    if (orgError) {
      console.error('[API/Voice/Stats] Database error fetching organization:', orgError)
      return NextResponse.json({ error: 'Voice service is not linked for this organization' }, { status: 404 })
    }

    voiceOrgId = orgData?.voice_org_id || null
    plan = orgData?.plan || 'trial'

    if (!voiceOrgId) {
      console.warn('[API/Voice/Stats] voice_org_id is null/undefined in database for orgId:', orgId)
      return NextResponse.json({ error: 'Voice service is not linked for this organization' }, { status: 404 })
    }

    // Retrieve the actual wallet balance from the Voice Supabase database (Account B)
    let voiceWalletCredits = 0.00
    const { data: voiceOrgData, error: voiceOrgError } = await supabaseVoiceAdmin
      .from('organizations')
      .select('wallet_balance')
      .eq('id', voiceOrgId)
      .single()

    if (voiceOrgError) {
      console.warn('[API/Voice/Stats] Failed to fetch wallet balance from Voice Supabase:', voiceOrgError.message)
    } else {
      voiceWalletCredits = voiceOrgData?.wallet_balance ? Number(voiceOrgData.wallet_balance) : 0.00
    }

    console.log('[API/Voice/Stats] Successfully mapped to voiceOrgId:', voiceOrgId, 'voice wallet balance:', voiceWalletCredits)

    const { searchParams } = new URL(req.url)
    const timeRange = searchParams.get('timeRange') || '7d'

    // Determine time filter
    const now = new Date()
    const daysBack = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30
    const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString()

    // 1. Get EXACT total call count
    const { count: exactTotalCalls, error: countError } = await supabaseVoiceAdmin
      .from('call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', voiceOrgId)
      .gte('created_at', since)

    if (countError) {
      console.error('[API/Voice/Stats] Error querying exact call logs count from Voice DB:', countError)
      throw countError
    }

    console.log(`[API/Voice/Stats] Exact total calls count: ${exactTotalCalls} for voiceOrgId: ${voiceOrgId}`)

    // 2. Fetch all logs for duration and cost totals
    const { data: allBilling, error: billingError } = await supabaseVoiceAdmin
      .from('call_logs')
      .select('duration_seconds, cost')
      .eq('organization_id', voiceOrgId)

    if (billingError) throw billingError

    const billingArr = allBilling || []
    const totalDurationSeconds = billingArr.reduce((sum, l) => sum + (l.duration_seconds || 0), 0)
    const totalMinutes = totalDurationSeconds / 60
    const avgDuration = billingArr.length > 0 ? Math.round(totalDurationSeconds / billingArr.length) : 0

    // Wallet calculations: 100 free calling minutes, overage at ₹3.5/min
    const freeMinutesLimit = 100
    const freeMinutesUsed = Math.min(totalMinutes, freeMinutesLimit)
    const overageMinutes = Math.max(0, totalMinutes - freeMinutesLimit)
    const overageRate = 3.5
    const creditsConsumed = overageMinutes * overageRate
    const remainingBalance = voiceWalletCredits - creditsConsumed

    return NextResponse.json({
      totalCalls: exactTotalCalls || 0,
      totalMinutes: Number(totalMinutes.toFixed(2)),
      minutesLimit: freeMinutesLimit,
      avgDuration,
      totalCost: Number(creditsConsumed.toFixed(2)),
      wallet: {
        voice_wallet_credits: Number(voiceWalletCredits.toFixed(2)),
        free_minutes_allowance: freeMinutesLimit,
        free_minutes_used: Number(freeMinutesUsed.toFixed(2)),
        overage_minutes: Number(overageMinutes.toFixed(2)),
        overage_rate: overageRate,
        credits_consumed: Number(creditsConsumed.toFixed(2)),
        remaining_balance: Number(remainingBalance.toFixed(2))
      }
    })
  } catch (err: any) {
    const error = err?.message || err?.details || String(err) || 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
