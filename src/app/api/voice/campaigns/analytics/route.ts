import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin, supabaseAdmin, getOrgId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
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
      realCampaigns.map(async (camp) => {
        // Contact status breakdown
        const { data: contacts } = await supabaseVoiceAdmin!
          .from('campaign_contacts')
          .select('id, status, duration_seconds, phone_number')
          .eq('campaign_id', camp.id)

        const contactList = contacts || []
        const total = contactList.length
        const completed = contactList.filter(c => c.status === 'completed').length
        const failed = contactList.filter(c => c.status === 'failed' || c.status === 'no-answer').length
        const pending = contactList.filter(c => c.status === 'pending').length
        const inProgress = contactList.filter(c => c.status === 'in-progress').length

        // Call logs for this campaign's contacts
        const contactIds = contactList.map(c => c.id)
        let callLogs: any[] = []
        if (contactIds.length > 0) {
          // Match call logs by phone numbers from this campaign
          const phones = contactList.map(c => c.phone_number).filter(Boolean)
          if (phones.length > 0) {
            const { data: logs } = await supabaseVoiceAdmin!
              .from('call_logs')
              .select('duration_seconds, cost, status, created_at, to_phone_number, recording_url')
              .eq('organization_id', voiceOrgId)
              .eq('agent_id', camp.agent_id)
              .in('to_phone_number', phones)
              .gte('created_at', camp.created_at)

            callLogs = logs || []
          }
        }

        const totalDuration = callLogs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0)
        const totalCost = callLogs.reduce((sum, l) => sum + (l.cost || 0), 0)
        const avgDuration = callLogs.length > 0 ? totalDuration / callLogs.length : 0
        const answeredLogs = callLogs.filter(l => l.status === 'completed' && (l.duration_seconds || 0) > 5)
        const answerRate = total > 0 ? Math.round((answeredLogs.length / total) * 100) : 0
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
        const withRecording = callLogs.filter(l => l.recording_url).length

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
          total_calls: callLogs.length,
          answered_calls: answeredLogs.length,
          answer_rate: answerRate,
          completion_rate: completionRate,
          total_duration_seconds: totalDuration,
          avg_duration_seconds: Math.round(avgDuration),
          total_cost: Math.round(totalCost * 100) / 100,
          recordings_available: withRecording,
        }
      })
    )

    return NextResponse.json(analytics)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
