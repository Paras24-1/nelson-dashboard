import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversation_id')
    if (!conversationId) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })

    // First, try matching directly by conversation_id
    let { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (error) throw error

    // If not found by conversation_id, fall back to matching by phone number
    if (!data) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('phone_number')
        .eq('id', conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (conv?.phone_number) {
        const phone = conv.phone_number.replace(/\D/g, '').slice(-10)
        const { data: leadData, error: leadError } = await supabaseAdmin
          .from('leads')
          .select('*')
          .ilike('phone_number', `%${phone}`)
          .eq('org_id', orgId)
          .maybeSingle()

        if (leadError) throw leadError
        
        if (leadData) {
          data = leadData
          // Auto-heal/link the conversation_id
          await supabaseAdmin
            .from('leads')
            .update({ conversation_id: conversationId })
            .eq('id', data.id)
          data.conversation_id = conversationId
        }
      }
    }

    return NextResponse.json(data || {})
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { conversation_id, metadata, ...updates } = body
    if (!conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })

    let parsedMeta: any = metadata
    if (metadata && typeof metadata === 'string') {
      try { parsedMeta = JSON.parse(metadata) } catch (e) {}
    }

    // Calculate lead_quality & lead_temperature dynamically based on lead_score sent by n8n
    const sentScore = updates.lead_score ?? parsedMeta?.lead_score;
    if (sentScore !== undefined) {
      const numericScore = Number(sentScore);
      if (!isNaN(numericScore)) {
        let temp = 'COLD';
        if (numericScore >= 70) temp = 'HOT';
        else if (numericScore >= 40) temp = 'WARM';
        
        updates.lead_temperature = temp;
        updates.lead_quality = temp.toLowerCase();
        updates.lead_score = numericScore;
      }
    }
    if (parsedMeta) {
      updates.metadata = parsedMeta
    }

    // First try updating by conversation_id
    let { data, error } = await supabaseAdmin
      .from('leads')
      .update(updates)
      .eq('conversation_id', conversation_id)
      .eq('org_id', orgId)
      .select()
      .maybeSingle()

    // If not found by conversation_id, fall back to phone number
    if (!data) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('phone_number')
        .eq('id', conversation_id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (conv?.phone_number) {
        const phone = conv.phone_number.replace(/\D/g, '').slice(-10)
        const { data: leadData, error: leadError } = await supabaseAdmin
          .from('leads')
          .update({
            ...updates,
            conversation_id // auto-link it
          })
          .ilike('phone_number', `%${phone}`)
          .eq('org_id', orgId)
          .select()
          .maybeSingle()

        if (leadError) throw leadError
        data = leadData || null
      }
    }

    // If still not found, upsert a new lead row for the conversation
    if (!data) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('phone_number, name')
        .eq('id', conversation_id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (conv) {
        const { data: upsertData, error: upsertError } = await supabaseAdmin
          .from('leads')
          .upsert({
            ...updates,
            conversation_id,
            org_id: orgId,
            phone_number: conv.phone_number,
            name: conv.name || '',
            stage: updates.stage || 'new'
          }, { onConflict: 'conversation_id' })
          .select()
          .maybeSingle()

        if (upsertError) throw upsertError
        data = upsertData || null
      }
    }

    if (error && !data) throw error

    if (updates.name || updates.stage) {
      await supabaseAdmin
        .from('conversations')
        .update({
          ...(updates.name  ? { name: updates.name }   : {}),
          ...(updates.stage ? { stage: updates.stage } : {}),
        })
        .eq('id', conversation_id)
        .eq('org_id', orgId)
    }

    return NextResponse.json(data || {})
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}