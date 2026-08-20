import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    
    // Accept flexible payload structures since the exact Voice SaaS might vary
    let rawPhone = payload.phone_number || payload.contact?.phone_number || payload.customer?.phone || payload.to || ''
    if (!rawPhone) {
      return NextResponse.json({ error: 'Missing phone number in payload' }, { status: 400 })
    }
    
    const phone = rawPhone.replace(/\D/g, '').slice(-10)
    
    const duration = payload.duration_seconds || payload.call?.duration_seconds || payload.duration || 0
    const summary = payload.summary || payload.call?.summary || payload.transcript || ''
    const recordingUrl = payload.recording_url || payload.call?.recording_url || ''
    const status = payload.status || payload.call?.status || 'completed'
    const outcome = payload.outcome || payload.call?.outcome || ''
    const orgId = payload.org_id || new URL(req.url).searchParams.get('org_id')

    // Find the lead in the CRM
    let query = supabaseAdmin.from('leads').select('*').ilike('phone_number', `%${phone}`)
    if (orgId) {
      query = query.eq('org_id', orgId)
    }
    
    const { data: leadData, error: leadError } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
    
    if (leadError) throw leadError
    
    if (!leadData) {
      return NextResponse.json({ error: 'Lead not found in CRM' }, { status: 404 })
    }

    // Capture the Voice AI call outcomes, durations, and summaries and save them into the CRM
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({
        conversation_summary: summary || leadData.conversation_summary,
        metadata: {
          ...((leadData.metadata as Record<string, any>) || {}),
          voice_duration: duration,
          voice_status: status,
          voice_recording_url: recordingUrl,
          voice_outcome: outcome
        }
      })
      .eq('id', leadData.id)

    if (updateError) throw updateError

    // STATE MACHINE TRANSITION: Voice -> WhatsApp Context Transfer
    if (status === 'completed' && summary && leadData.org_id) {
       const isOptOut = summary.toLowerCase().includes('not interested') || 
                        summary.toLowerCase().includes('stop') ||
                        outcome.toLowerCase() === 'suppressed'
       
       if (isOptOut) {
         // Apply Suppression Check rule from spec
         await supabaseAdmin.from('leads').update({ lead_temperature: 'SUPPRESSED' }).eq('id', leadData.id)
       } else {
         // Trigger Async WhatsApp Handover
         // Wait for fetch to ensure Vercel does not suspend the lambda container
         await fetch(`https://voxaiagents.com/api/conversations/initiate`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             phone: leadData.phone_number,
             name: leadData.name || 'there',
             template_name: 'voice_ai_handover', // Standard template name for handover
             template_lang: 'en',
             variables: [leadData.name || 'there'],
             message_text: `Hi ${leadData.name || ''}, this is the iWebMagics team. Following up on our call! Would you like me to send over the website designs we discussed?`,
             userId: 'system'
           })
         }).catch(err => console.error('[webhook/voice] WhatsApp handover failed:', err))
       }
    }

    return NextResponse.json({ success: true, lead_id: leadData.id })
  } catch (err: any) {
    console.error('[webhook/voice]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
