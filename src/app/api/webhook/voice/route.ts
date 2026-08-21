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
    // 1. Extract standard fields
    const phone = rawPhone.replace(/\\D/g, '').slice(-10)
    const duration = payload.duration_seconds || payload.call?.duration_seconds || payload.duration || 0
    const summary = payload.summary || payload.call?.summary || payload.transcript || ''
    const recordingUrl = payload.recording_url || payload.call?.recording_url || ''
    const status = payload.status || payload.call?.status || 'completed'
    const outcome = payload.outcome || payload.call?.outcome || ''
    const orgId = payload.org_id || new URL(req.url).searchParams.get('org_id')
    
    if (!orgId) {
      return NextResponse.json({ error: 'Missing org_id' }, { status: 400 })
    }

    // 2. Extract custom variables (Industry, Timeline, etc)
    // Support top-level, payload.variables, or payload.extracted_data
    const customVariables = {
      ...(payload.variables || {}),
      ...(payload.extracted_data || {}),
      ...(payload.call?.variables || {})
    }
    
    // Also grab any top-level keys that aren't standard
    const standardKeys = ['phone_number', 'contact', 'customer', 'to', 'duration_seconds', 'call', 'duration', 'summary', 'transcript', 'recording_url', 'status', 'outcome', 'org_id', 'variables', 'extracted_data']
    Object.keys(payload).forEach(key => {
      if (!standardKeys.includes(key)) {
        customVariables[key] = payload[key]
      }
    })

    // 3. Find or Create Lead (Upsert)
    const { data: leadData, error: leadError } = await supabaseAdmin
      .from('leads')
      .upsert({
        phone_number: phone,
        org_id: orgId,
        name: payload.name || payload.contact?.name || phone
      }, { onConflict: 'phone_number,org_id' })
      .select()
      .single()
      
    if (leadError) throw leadError

    // 4. Update Lead Metadata with Voice Data & Custom Variables
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({
        metadata: {
          ...((leadData.metadata as Record<string, any>) || {}),
          ...customVariables,
          voice_summary: summary || leadData.metadata?.voice_summary || '',
          voice_duration: duration,
          voice_status: status,
          voice_recording_url: recordingUrl,
          voice_outcome: outcome
        }
      })
      .eq('id', leadData.id)

    if (updateError) throw updateError

    // 5. STATE MACHINE TRANSITION: Voice -> WhatsApp Context Transfer
    if (status === 'completed' && summary) {
       const isOptOut = summary.toLowerCase().includes('not interested') || 
                        summary.toLowerCase().includes('stop') ||
                        outcome.toLowerCase() === 'suppressed'
       
       if (isOptOut) {
         // Apply Suppression Check rule from spec
         await supabaseAdmin.from('leads').update({ lead_temperature: 'SUPPRESSED' }).eq('id', leadData.id)
       } else {
         // Determine Demo Link from Knowledge Base if possible
         let demoLink = 'https://iwebmagics.com/portfolio' // Fallback link
         const industry = customVariables.industry || ''
         
         if (industry) {
           const { data: orgSettings } = await supabaseAdmin.from('organization_settings')
             .select('ai_knowledge_base_sheet_id, ai_knowledge_base_range, google_sheets_api_key')
             .eq('org_id', orgId)
             .maybeSingle()
             
           if (orgSettings?.ai_knowledge_base_sheet_id) {
             const apiKey = orgSettings.google_sheets_api_key || process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY
             if (apiKey) {
               const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${orgSettings.ai_knowledge_base_sheet_id}/values/${orgSettings.ai_knowledge_base_range || 'Sheet1!A:Z'}?key=${apiKey}`
               try {
                 const res = await fetch(sheetUrl)
                 if (res.ok) {
                   const data = await res.json()
                   const rows = data.values || []
                   // Assuming sheet columns: [SKU, Name, Link, Industry] -> Link is usually index 2, Industry is index 3
                   // Let's do a fuzzy search across the whole row just in case
                   const match = rows.find((r: string[]) => r.some(cell => cell.toLowerCase().includes(industry.toLowerCase())))
                   if (match) {
                     // Try to find the cell that looks like a URL
                     const urlCell = match.find((cell: string) => cell.startsWith('http'))
                     if (urlCell) demoLink = urlCell
                   }
                 }
               } catch (e) {
                 console.error('[webhook/voice] Sheet fetch error:', e)
               }
             }
           }
         }

         // Trigger Async WhatsApp Handover
         // Wait for fetch to ensure Vercel does not suspend the lambda container
         await fetch(`https://voxaiagents.com/api/conversations/initiate`, {
           method: 'POST',
           headers: { 
             'Content-Type': 'application/json',
             'x-internal-secret': process.env.N8N_WEBHOOK_SECRET || 'internal-ai-reply'
           },
           body: JSON.stringify({
             phone: leadData.phone_number,
             name: leadData.name || 'there',
             template_name: 'call_connect2',
             template_lang: 'en',
             variables: [leadData.name || 'there', demoLink],
             message_text: `Hello ${leadData.name || 'there'},\n\nThank you for speaking with our assistant from iWebMagics just now!\n\nAs promised, here is the live demo website we built for your business category: 🔗 ${demoLink}\n\nHave a look and let us know what you think. You can reply directly to this message to discuss your project requirements or get a custom quotation.\n\nBest regards, iWebMagics Team`,
             org_id: orgId
           })
         }).catch(err => console.error('[webhook/voice] WhatsApp handover failed:', err))
       }
    }

    return NextResponse.json({ success: true, lead_id: leadData.id })
  } catch (err: any) {
    console.error('[webhook/voice]', err)
    return NextResponse.json({ error: typeof err === 'object' ? JSON.stringify(err) : String(err) }, { status: 500 })
  }
}
