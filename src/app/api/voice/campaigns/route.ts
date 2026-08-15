import { NextRequest, NextResponse } from 'next/server'
import { supabaseVoiceAdmin, supabaseAdmin, getOrgId } from '@/lib/supabase'

// GET: Retrieve all campaigns and calculate their stats
export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!supabaseVoiceAdmin) {
      return NextResponse.json({ error: 'Voice service is not configured' }, { status: 501 })
    }

    const voiceAdmin = supabaseVoiceAdmin!

    // Retrieve the mapped Voice SaaS Organization ID from the main database
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('voice_org_id')
      .eq('id', orgId)
      .single()

    if (orgError || !orgData?.voice_org_id) {
      return NextResponse.json({ error: 'Voice service is not linked for this organization' }, { status: 404 })
    }

    const voiceOrgId = orgData.voice_org_id

    // Fetch campaigns
    const { data: campaignsData, error: campaignsError } = await voiceAdmin
      .from('campaigns')
      .select('*, agents(name)')
      .eq('organization_id', voiceOrgId)
      .order('created_at', { ascending: false })

    if (campaignsError) throw campaignsError

    // Calculate total and completed stats for each campaign
    const campaignsWithStats = await Promise.all(
      (campaignsData || [])
        .filter((camp) => !camp.name?.startsWith('Test Call - '))
        .map(async (camp) => {
          const { count: total } = await voiceAdmin
            .from('campaign_contacts')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', camp.id)

          const { count: completed } = await voiceAdmin
            .from('campaign_contacts')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', camp.id)
            .eq('status', 'completed')

          return {
            ...camp,
            total_contacts: total || 0,
            completed_contacts: completed || 0
          }
        })
    )

    return NextResponse.json(campaignsWithStats)
  } catch (err: any) {
    const error = err?.message || err?.details || String(err) || 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}

// POST: Launch a new campaign and bulk insert contacts
export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!supabaseVoiceAdmin) {
      return NextResponse.json({ error: 'Voice service is not configured' }, { status: 501 })
    }

    const { name, agentId, contacts } = await req.json()
    if (!name || !agentId || !contacts || !Array.isArray(contacts)) {
      return NextResponse.json({ error: 'Missing required parameters: name, agentId, contacts' }, { status: 400 })
    }

    // Retrieve the mapped Voice SaaS Organization ID
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('voice_org_id')
      .eq('id', orgId)
      .single()

    if (orgError || !orgData?.voice_org_id) {
      return NextResponse.json({ error: 'Voice service is not linked for this organization' }, { status: 404 })
    }

    const voiceOrgId = orgData.voice_org_id

    // 1. Create the campaign in Voice SaaS DB (Account B)
    const { data: campaign, error: campErr } = await supabaseVoiceAdmin
      .from('campaigns')
      .insert({
        name,
        agent_id: agentId,
        organization_id: voiceOrgId,
        status: 'draft'
      })
      .select()
      .single()

    if (campErr) throw campErr

    // 2. Insert contacts associated with the campaign
    const contactsToInsert = contacts.map((c: any) => ({
      campaign_id: campaign.id,
      name: c.name,
      phone_number: c.phone_number,
      status: 'pending'
    }))

    const { error: contactsErr } = await supabaseVoiceAdmin
      .from('campaign_contacts')
      .insert(contactsToInsert)

    if (contactsErr) throw contactsErr

    return NextResponse.json(campaign)
  } catch (err: any) {
    const error = err?.message || err?.details || String(err) || 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}

// DELETE: Delete a campaign by ID securely (scoped to tenant voice_org_id)
export async function DELETE(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!supabaseVoiceAdmin) {
      return NextResponse.json({ error: 'Voice service is not configured' }, { status: 501 })
    }

    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('id')
    if (!campaignId) {
      return NextResponse.json({ error: 'Missing query parameter: id' }, { status: 400 })
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

    // Delete campaign (scoped securely using organization_id)
    const { data, error } = await supabaseVoiceAdmin
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('organization_id', voiceOrgId)
      .select()

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ success: true, deleted: data[0] })
  } catch (err: any) {
    const error = err?.message || err?.details || String(err) || 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
