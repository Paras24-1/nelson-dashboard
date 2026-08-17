import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin, supabaseAdmin, getOrgId } from '@/lib/supabase'
import { cookies } from 'next/headers'

function cleanPhone(p: string | null | undefined): string {
  if (!p) return ''
  const digits = p.replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : (digits.length >= 5 ? digits : '')
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

    // Fetch all call logs for this organization to link recordings and costs
    const { data: allLogs } = await supabaseVoiceAdmin
      .from('call_logs')
      .select('duration_seconds, cost, status, created_at, to_phone_number, recording_url, call_sid, call_uuid, lead_details')
      .eq('organization_id', voiceOrgId)

    const rawLogs = allLogs || []

    // For each campaign, compute analytics directly from campaign_contacts
    const analytics = await Promise.all(
      realCampaigns.map(async (camp) => {
        const { data: contacts } = await supabaseVoiceAdmin!
          .from('campaign_contacts')
          .select('id, name, status, duration_seconds, phone_number, call_sid, created_at, updated_at')
          .eq('campaign_id', camp.id)

        const contactList = contacts || []
        const total = contactList.length
        const completed = contactList.filter(c => c.status === 'completed').length
        const failed = contactList.filter(c => c.status === 'failed' || c.status === 'no-answer').length
        const pending = contactList.filter(c => c.status === 'pending').length
        const inProgress = contactList.filter(c => c.status === 'in-progress').length

        const callsTriggered = completed + failed + inProgress

        // Build lead-by-lead details
        const leadDetails = contactList.map((contact) => {
          const p1 = cleanPhone(contact.phone_number)
          const p2 = cleanPhone(contact.name)
          const targetPhone = p1 || p2 || ''

          // Find matching log by call_sid, phone number, or lead name
          const matchedLog = rawLogs.find(l => {
            const logPhone = cleanPhone(l.to_phone_number)
            const sidMatch = contact.call_sid && (l.call_sid === contact.call_sid || l.call_uuid === contact.call_sid)
            const phoneMatch = targetPhone && logPhone && targetPhone === logPhone
            const nameMatch = l.lead_details && (l.lead_details.name === contact.name || l.lead_details.name === contact.phone_number)
            return sidMatch || phoneMatch || nameMatch
          })

          const recording = matchedLog?.recording_url || null
          const isAnswered = contact.status === 'completed' || (contact.duration_seconds || 0) > 0 || (matchedLog?.duration_seconds || 0) > 0
          const durationSec = contact.duration_seconds || matchedLog?.duration_seconds || 0
          const attempts = contact.status === 'pending' ? 0 : 1

          return {
            id: contact.id,
            name: contact.name || 'Unnamed Lead',
            phone_number: contact.phone_number,
            status: contact.status,
            attempts: attempts,
            answered: isAnswered,
            duration_seconds: durationSec,
            cost: matchedLog?.cost || 0,
            recording_url: recording,
            last_call_at: matchedLog?.created_at || contact.updated_at || contact.created_at
          }
        })

        const answeredCallsCount = leadDetails.filter(l => l.answered).length
        const totalDuration = leadDetails.reduce((sum, l) => sum + (l.duration_seconds || 0), 0)
        const totalCost = leadDetails.reduce((sum, l) => sum + (l.cost || 0), 0)
        const avgDuration = answeredCallsCount > 0 ? Math.round(totalDuration / answeredCallsCount) : 0
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
          avg_duration_seconds: avgDuration,
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
