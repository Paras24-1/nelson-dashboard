import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversation_id')
    const rawPhone = searchParams.get('phone') || ''
    const phone = rawPhone.replace(/\D/g, '').slice(-10)

    let data = null
    let error = null

    // First try by conversation_id if provided
    if (conversationId) {
      const { data: leadData, error: leadError } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (leadError) throw leadError
      data = leadData
    }

    // Fall back to phone number lookup if not found by conversationId
    if (!data && phone) {
      const { data: leadData, error: leadError } = await supabaseAdmin
        .from('leads')
        .select('*')
        .ilike('phone_number', `%${phone}`)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (leadError) throw leadError
      data = leadData
    }

    if (!data) {
      return NextResponse.json({ error: 'No matching lead found' }, { status: 404 })
    }

    // Safely parse metadata if it is a JSON string
    let metadataObj = {}
    if (data.metadata) {
      if (typeof data.metadata === 'string') {
        try {
          metadataObj = JSON.parse(data.metadata)
        } catch (e) {
          console.error('Failed to parse metadata string:', e)
        }
      } else if (typeof data.metadata === 'object') {
        metadataObj = data.metadata
      }
    }

    // Map database column names to match the exact keys expected by LeadPanel.tsx (which mapped from Google Sheets)
    const lead = {
      id: data.id,
      conversation_id: data.conversation_id,
      Phone: data.phone_number,
      Name: data.name || '',
      Lead_Type: data.lead_type || '',
      city: data.city || '',
      machine_interest: data.machine_interest || '',
      lead_quality: data.lead_quality || '',
      lead_score: String(data.lead_score || 0),
      lead_temperature: data.lead_temperature || '',
      callback_ready: data.callback_ready || '',
      conversation_summary: data.conversation_summary || '',
      followup_date: data.followup_date || null,
      followup_notes: data.followup_notes || null,
      followup_notified: data.followup_notified || false,
      stage: data.stage || 'new',
      ...(metadataObj || {}) // Dynamically unpack all custom columns (e.g. Tehsil, Crop_Requirement)
    }

    return NextResponse.json(lead)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
