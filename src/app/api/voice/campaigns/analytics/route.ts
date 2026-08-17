import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin, supabaseAdmin, getOrgId } from '@/lib/supabase'
import { cookies } from 'next/headers'

function cleanPhone(p: string | null | undefined): string {
  if (!p) return ''
  const digits = p.replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : digits
}

export async function GET(req: NextRequest) {
  try {
    let orgId = await getOrgId(req)
    
    // Robust fallback using next/headers if NextRequest headers are stripped
    if (!orgId) {
      const cookieStore = cookies()
      const tokenCookie = cookieStore.get('sb-jncmizoejeaclpnfxazg-auth-token')
      if (tokenCookie?.value) {
        try {
          const parsed = JSON.parse(decodeURIComponent(tokenCookie.value))
          const accessToken = parsed.access_token || parsed[0]?.access_token
          if (accessToken) {
            const { data } = await supabaseAdmin.auth.getUser(accessToken)
            if (data?.user?.id) {
              const { data: profile } = await supabaseAdmin
                .from('users')
                .select('org_id')
                .eq('id', data.user.id)
                .single()
              if (profile?.org_id) orgId = profile.org_id
            }
          }
        } catch (e) {
          console.error("Fallback cookie parsing failed", e)
        }
      }
    }

    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!supabaseVoiceAdmin) return NextResponse.json({ error: 'Voice service not configured' }, { status: 501 })

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('voice_org_id')
      .eq('id', orgId)
      .single()

    if (orgError || !orgData?.voice_org_id) {
      return NextResponse.json({ error: 'Voice service not linked' }, { status: 404 })
    }
    const voiceOrgId = orgData.voice_org_id

    // Fetch all campaigns (excluding test calls)
    const { data: campaigns, error: campErr } = await supabaseVoiceAdmin
      .from('campaigns')
      .select('*, agents(name)')
      .eq('organization_id', voiceOrgId)
      .order('created_at', { ascending: false })

    if (campErr) throw campErr

    const realCampaigns = (campaigns || []).filter(c => !c.name?.startsWith('Test Call - '))

    // For each campaign, fetch detailed analytics
    const analytics = await Promise.all(
      realCampaigns.map(async (camp, idx) => {
        // Contact status breakdown
        const { data: contacts } = await supabaseVoiceAdmin!
          .from('campaign_contacts')
          .select('id, name, status, duration_seconds, phone_number')
          .eq('campaign_id', camp.id)

        const contactList = contacts || []
        const total = contactList.length
        const completed = contactList.filter(c => c.status === 'completed').length
        const failed = contactList.filter(c => c.status === 'failed' || c.status === 'no-answer').length
        const pending = contactList.filter(c => c.status === 'pending').length
        const inProgress = contactList.filter(c => c.status === 'in-progress').length

        // Determine campaign timeframe window to isolate call logs
        // Upper bound: Next campaign's start time (idx > 0 because sorted DESC), or camp.updated_at + 15m, or created_at + 24h
        let lteTime: string | null = null
        if (idx > 0 && realCampaigns[idx - 1]?.created_at) {
          lteTime = realCampaigns[idx - 1].created_at
        } else if (camp.updated_at && camp.status === 'completed') {
          lteTime = new Date(new Date(camp.updated_at).getTime() + 15 * 60 * 1000).toISOString()
        }

        // Fetch call logs in this campaign's timeframe
        let logsQuery = supabaseVoiceAdmin!
          .from('call_logs')
          .select('duration_seconds, cost, status, created_at, to_phone_number, recording_url')
          .eq('organization_id', voiceOrgId)
          .eq('agent_id', camp.agent_id)
          .gte('created_at', camp.created_at)

        if (lteTime) {
          logsQuery = logsQuery.lte('created_at', lteTime)
        }

        const { data: logs } = await logsQuery
        const rawLogs = logs || []

        // Filter logs matching contacts in this campaign using normalized 10-digit phone numbers
        const campaignPhones = new Set(contactList.map(c => cleanPhone(c.phone_number)))
        const callLogs = rawLogs.filter(l => campaignPhones.has(cleanPhone(l.to_phone_number)))

        const totalDuration = callLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0)
        const totalCost = callLogs.reduce((sum, l) => sum + (l.cost || 0), 0)
        const avgDuration = callLogs.length > 0 ? totalDuration / callLogs.length : 0

        // Calls attempted in this campaign
        const callsTriggered = completed + failed + inProgress

        // Build lead-by-lead details
        const leadDetails = contactList.map((contact) => {
          const cPhone = cleanPhone(contact.phone_number)
          const cLogs = callLogs.filter((l) => cleanPhone(l.to_phone_number) === cPhone)
          const answeredLog = cLogs.find((l) => l.status === 'completed' && (l.duration_seconds || 0) > 5)
          const recording = cLogs.find((l) => l.recording_url)?.recording_url || null
          const totalDur = cLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0)
          const latestCallTime = cLogs.length > 0 ? cLogs[cLogs.length - 1].created_at : null

          // Attempts for a campaign contact: 1 if attempted (completed/failed/in-progress), 0 if pending
          const attempts = contact.status === 'pending' ? 0 : 1

          return {
            id: contact.id,
            name: contact.name || 'Unnamed Lead',
            phone_number: contact.phone_number,
            status: contact.status,
            attempts: attempts,
            answered: contact.status === 'completed' || !!answeredLog,
            duration_seconds: totalDur || contact.duration_seconds || 0,
            recording_url: recording,
            last_call_at: latestCallTime
          }
        })

        const answeredCallsCount = leadDetails.filter(l => l.answered).length
        const answerRate = callsTriggered > 0 ? Math.min(100, Math.round((answeredCallsCount / callsTriggered) * 100)) : 0
        const completionRate = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
        const withRecording = leadDetails.filter(l => l.recording_url).length

        return {
          id: camp.id,
          name: camp.name,
          status: camp.status,
          agent_name: camp.agents?.name || 'Unknown Agent',
          created_at: camp.created_at,
          // Contact stats
          total_contacts: total,
          completed_contacts: completed,
          failed_contacts: failed,
          pending_contacts: pending,
          in_progress_contacts: inProgress,
          // Call stats
          total_calls: callsTriggered,
          answered_calls: answeredCallsCount,
          answer_rate: answerRate,
          completion_rate: completionRate,
          total_duration_seconds: totalDuration,
          avg_duration_seconds: Math.round(avgDuration),
          total_cost: Math.round(totalCost * 100) / 100,
          recordings_available: withRecording,
          contacts: leadDetails
        }
      })
    )

    return NextResponse.json(analytics)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
