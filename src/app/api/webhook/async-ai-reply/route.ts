import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, phone_number, message, conversation_id } = body

    if (!orgId || !phone_number || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Fetch tenant AI Settings
    const { data: orgSettings } = await supabaseAdmin
      .from('organization_settings')
      .select('gemini_api_key, ai_system_prompt')
      .eq('org_id', orgId)
      .maybeSingle()

    const tenantAiKey = orgSettings?.gemini_api_key || process.env.GEMINI_API_KEY
    if (!tenantAiKey) {
      console.warn('[async-ai-reply] No GEMINI_API_KEY provided. Skipping AI reply.')
      return NextResponse.json({ error: 'No GEMINI_API_KEY' }, { status: 500 })
    }

    // 1. Fetch Lead context & metadata
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id, metadata, lead_score, lead_temperature, industry, name')
      .eq('phone_number', phone_number)
      .eq('org_id', orgId)
      .maybeSingle()
    
    // 2. Fetch last 5 messages for context
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('message, direction')
      .eq('conversation_id', conversation_id)
      .order('timestamp', { ascending: false })
      .limit(5)
    
    const chatContext = (history || []).reverse().map(m => 
      `${m.direction === 'incoming' ? 'Customer' : 'AI'}: ${m.message}`
    ).join('\n')

    const metadata = lead?.metadata || {}
    const industry = metadata.industry || lead?.industry || 'Business'
    const websiteStatus = metadata.website_status || 'Unknown'
    const currentScore = lead?.lead_score || 0

    // 3. Call Gemini for Reply & Scoring
    const customPromptBase = orgSettings?.ai_system_prompt || 'You are a WhatsApp AI consultant for iWebMagics.'
    
    const systemPrompt = `${customPromptBase}
Context:
Customer Name: ${lead?.name || 'Unknown'}
Industry: ${industry}
Website Status: ${websiteStatus}
Voice AI Summary: ${metadata.voice_summary || 'N/A'}

Do NOT ask questions that have already been answered in the Voice AI Summary.
Provide a helpful, concise response to the customer's last message.

Also, evaluate the customer's intent based on this exact matrix and provide a score adjustment:
- Website required: +20
- Timeline <= 30 days: +20
- Asked payment/start-date: +20
- Asked quotation: +15
- Requested human contact: +15
- Interested in designs: +10
- Selected design: +10
- Asked pricing: +10
- Timeline 1-3 months: +5
- Just researching: -10
- No current requirement: -20
- Explicit NOT INTERESTED: -100

Respond in JSON format with exactly these keys:
{
  "replyMessage": "Your text response to the user",
  "scoreAdjustment": 20,
  "reasoning": "They asked for pricing (+10) and designs (+10)",
  "extractedTimeline": "less than 30 days"
}`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${tenantAiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `Recent chat history:\n${chatContext}\n\nAnalyze the customer's last message and generate the JSON response.` }]
          }
        ],
        systemInstruction: {
          role: "system",
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini error: ${await response.text()}`)
    }

    const aiData = await response.json()
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const content = JSON.parse(rawText)
    
    // 4. Update Lead Score & Temperature natively
    const newScore = currentScore + (content.scoreAdjustment || 0)
    let newTemp = lead?.lead_temperature || 'COLD'
    
    if (content.scoreAdjustment === -100) newTemp = 'SUPPRESSED'
    else if (newScore >= 70) newTemp = 'HOT'
    else if (newScore >= 40) newTemp = 'WARM'
    else if (newScore >= 20) newTemp = 'COLD'
    else newTemp = 'COLD'

    // Save back to DB
    const newMetadata = { ...metadata, timeline: content.extractedTimeline || metadata.timeline }
    
    await supabaseAdmin
      .from('leads')
      .update({
        lead_score: newScore,
        lead_temperature: newTemp,
        metadata: newMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('phone_number', phone_number)
      .eq('org_id', orgId)

    // 5. Send WhatsApp Reply by posting to our own /api/reply endpoint
    if (content.replyMessage) {
      await fetch(`${req.nextUrl.origin}/api/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id,
          phone_number,
          message: content.replyMessage
        })
      })
    }

    // 6. If HOT, Trigger Human Handover Task natively
    if (newTemp === 'HOT' && lead?.lead_temperature !== 'HOT') {
      if (lead?.id) {
        await supabaseAdmin.from('lead_activities').insert({
          lead_id: lead.id,
          activity_type: 'human_handover',
          description: 'Lead reached HOT status. Human Handover Required.',
          notes: `Reason: ${content.reasoning || 'AI Scoring threshold met.'}\nScore: ${newScore}\nTimeline: ${content.extractedTimeline || 'Unknown'}`
        })
      }
      
      // Stop Automation explicitly
      await supabaseAdmin.from('workflow_instances')
        .update({ status: 'completed' })
        .eq('phone_number', phone_number)
        .eq('org_id', orgId)

      console.log(`[async-ai-reply] Lead ${phone_number} reached HOT. Human Handover task created and automation stopped.`)
    }

    return NextResponse.json({ success: true, newScore, newTemp })

  } catch (err: any) {
    console.error('[async-ai-reply] Error:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
