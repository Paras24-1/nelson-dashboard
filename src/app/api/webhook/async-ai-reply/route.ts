import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, phone_number, message, conversation_id } = body

    console.log(`[async-ai-reply:start] orgId=${orgId} | phone=${phone_number} | conv=${conversation_id} | msg="${message?.substring(0, 50)}"`)

    if (!orgId || !phone_number || !message) {
      console.warn(`[async-ai-reply:error] Missing fields: orgId=${orgId} phone=${phone_number} message=${!!message}`)
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // 1. Parallelize initial database queries for max speed
    const [orgSettingsRes, leadRes, convRes, historyRes] = await Promise.all([
      supabaseAdmin
        .from('organization_settings')
        .select('gemini_api_key, ai_system_prompt, whatsapp_token, whatsapp_phone_id, ai_knowledge_base_sheet_id, ai_knowledge_base_range, google_sheets_api_key')
        .eq('org_id', orgId)
        .maybeSingle(),
      supabaseAdmin
        .from('leads')
        .select('id, metadata, lead_score, lead_temperature, industry, name, assigned_to, stage')
        .eq('phone_number', phone_number)
        .eq('org_id', orgId)
        .maybeSingle(),
      conversation_id
        ? supabaseAdmin
            .from('conversations')
            .select('provider_phone_id, assigned_to, name')
            .eq('id', conversation_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      conversation_id
        ? supabaseAdmin
            .from('messages')
            .select('message, direction')
            .eq('conversation_id', conversation_id)
            .order('timestamp', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: null })
    ])

    const orgSettings = orgSettingsRes.data
    let lead = leadRes.data
    const conv = convRes.data
    const history = historyRes.data

    // Fallback lead lookup by 10-digit phone suffix or conversation_id if exact match missed
    const cleanDigits = phone_number.replace(/\D/g, '').slice(-10)
    if (!lead && cleanDigits) {
      const { data: matchedLead } = await supabaseAdmin
        .from('leads')
        .select('id, metadata, lead_score, lead_temperature, industry, name, assigned_to, stage')
        .ilike('phone_number', `%${cleanDigits}`)
        .eq('org_id', orgId)
        .maybeSingle()
      if (matchedLead) lead = matchedLead
    }

    if (!lead && conversation_id) {
      const { data: matchedLead } = await supabaseAdmin
        .from('leads')
        .select('id, metadata, lead_score, lead_temperature, industry, name, assigned_to, stage')
        .eq('conversation_id', conversation_id)
        .eq('org_id', orgId)
        .maybeSingle()
      if (matchedLead) lead = matchedLead
    }

    // Auto-create lead if customer interacts via WhatsApp and no lead record exists yet
    if (!lead && cleanDigits) {
      const { data: newLead } = await supabaseAdmin
        .from('leads')
        .insert({
          phone_number: phone_number,
          name: conv?.name || 'Customer',
          org_id: orgId,
          conversation_id: conversation_id || null,
          lead_score: 40,
          lead_temperature: 'WARM',
          lead_quality: 'warm',
          metadata: { source: 'whatsapp_inbound', state: 'welcome' }
        })
        .select('id, metadata, lead_score, lead_temperature, industry, name, assigned_to, stage')
        .single()
      if (newLead) lead = newLead
    }

    console.log(`[async-ai-reply:settings] orgSettingsFound=${!!orgSettings} | hasGeminiKey=${!!orgSettings?.gemini_api_key} | hasPrompt=${!!orgSettings?.ai_system_prompt}`)

    let tenantAiKey = orgSettings?.gemini_api_key
    if (!tenantAiKey && orgSettings?.ai_system_prompt?.startsWith('{')) {
      try {
        const parsed = JSON.parse(orgSettings.ai_system_prompt)
        if (parsed.gemini_api_key) tenantAiKey = parsed.gemini_api_key
      } catch (e) {}
    }
    
    // If tenant key is empty, fallback to process.env.GEMINI_API_KEY
    if (!tenantAiKey || !tenantAiKey.trim()) {
      tenantAiKey = process.env.GEMINI_API_KEY || ''
    }

    if (!tenantAiKey) {
      console.warn(`[async-ai-reply:error] No valid GEMINI_API_KEY found for org ${orgId}. Skipping AI reply.`)
      return NextResponse.json({ error: 'No valid GEMINI_API_KEY' }, { status: 500 })
    }

    console.log(`[async-ai-reply:key] Key resolved: ${tenantAiKey.substring(0, 12)}... (length=${tenantAiKey.length})`)

    // Resolve assigned employee details
    let assignedEmployeeName = 'Unassigned'
    let assignedEmployeePhone = ''
    const assignedUserId = lead?.assigned_to || conv?.assigned_to
    if (assignedUserId) {
      const { data: emp } = await supabaseAdmin
        .from('users')
        .select('name, email, avatar')
        .eq('id', assignedUserId)
        .maybeSingle()
      if (emp) {
        assignedEmployeeName = emp.name || emp.email
        assignedEmployeePhone = (emp as any).phone_number || (emp.avatar && emp.avatar.startsWith('phone:') ? emp.avatar.replace('phone:', '') : '')
      }
    }

    // INTERCEPT & CANCEL AUTOMATED FOLLOW-UPS WHEN CUSTOMER REPLIES (non-blocking)
    if (lead) {
      (async () => {
        try {
          // Clear 6-hour follow-up on leads table
          await supabaseAdmin.from('leads')
            .update({
              followup_date: null,
              followup_notes: '[Automated Follow-up Cancelled: Customer Replied]'
            })
            .eq('id', lead.id)
            .eq('followup_notified', false)

          await supabaseAdmin.from('scheduled_drips')
            .update({ status: 'cancelled' })
            .eq('lead_id', lead.id)
            .eq('status', 'pending')
        } catch (e) {}
      })()
    }

    const chatContext = (history || []).reverse().map(m => 
      `${m.direction === 'incoming' ? 'Customer' : 'AI'}: ${m.message}`
    ).join('\n')

    let metadata = lead?.metadata || {}
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata)
      } catch (e) {
        metadata = {}
      }
    }

    const industry = metadata.industry || (metadata.business_intent && metadata.business_intent.toLowerCase().includes('clothing') ? 'Fashion' : '') || lead?.industry || 'Fashion'
    const businessIntent = metadata.business_intent || metadata.conversation_summary || 'New Website'
    const websiteStatus = metadata.website_status || 'Unknown'
    const currentScore = lead?.lead_score || 0

    // 3. Call Gemini for Reply & Scoring
    let rawPromptBase = orgSettings?.ai_system_prompt || 'You are a WhatsApp AI consultant for iWebMagics.'
    if (rawPromptBase.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawPromptBase)
        if (parsed.system_prompt) rawPromptBase = parsed.system_prompt
      } catch (e) {}
    }

    // Replace system prompt template variables
    const customPromptBase = rawPromptBase
      .replace(/\{\{lead_name\}\}/g, lead?.name || 'Customer')
      .replace(/\{\{phone_number\}\}/g, phone_number)
      .replace(/\{\{assigned_employee\}\}/g, assignedEmployeeName)
      .replace(/\{\{assigned_employee_name\}\}/g, assignedEmployeeName)
      .replace(/\{\{assigned_employee_phone\}\}/g, assignedEmployeePhone || '')
      .replace(/\{\{stage\}\}/g, lead?.lead_temperature || 'COLD')
      .replace(/\{\{industry\}\}/g, industry)
    
    // Optional Knowledge Base from Google Sheets
    let knowledgeBaseContext = ''
    if (orgSettings?.ai_knowledge_base_sheet_id) {
      try {
        const sheetId = orgSettings.ai_knowledge_base_sheet_id
        const range = orgSettings.ai_knowledge_base_range || 'Sheet1!A:Z'
        const apiKey = orgSettings.google_sheets_api_key || process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY
        
        if (apiKey) {
          const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
          const sheetRes = await fetch(sheetUrl, { next: { revalidate: 60 } })
          
          if (sheetRes.ok) {
            const sheetData = await sheetRes.json()
            const rows = sheetData.values || []
            if (rows.length > 0) {
              const headers = rows[0].join(' | ')
              const dataRows = rows.slice(1).map((r: string[]) => r.join(' | ')).join('\n')
              knowledgeBaseContext = `\n\n--- KNOWLEDGE BASE (CATALOG / LINKS) ---\nUse the following table to answer questions. If the user asks for a demo, link, or price, look it up here:\nHeaders: ${headers}\n${dataRows}\n----------------------------------------\n`
            }
          }
        }
      } catch (err) {
        console.error('[async-ai-reply] Google Sheets error:', err)
      }
    }

    const systemPrompt = `${customPromptBase}${knowledgeBaseContext}
Context:
Customer Name: ${lead?.name || 'Customer'}
Phone Number: ${phone_number}
Assigned Employee: ${assignedEmployeeName}
Target Industry: ${industry}
Business Intent: ${businessIntent}
Demo Selected: ${metadata.demo_selected || 'None'}
Website Status: ${websiteStatus}
Voice AI Summary: ${metadata.voice_summary || 'N/A'}

STRICT INDUSTRY MATCHING INSTRUCTION:
The customer's business category is strictly "${industry}" (Intent: "${businessIntent}").
You MUST ONLY recommend website designs, options, and responses relevant to ${industry} (e.g., for Fashion/Clothing, recommend clothing/e-commerce designs). 
DO NOT mention or suggest unrelated industries such as Real Estate, Education, or Healthcare.

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

    // Parse active AI model name from settings
    let selectedModel = 'gemini-flash-lite-latest'
    try {
      if (customPromptBase && customPromptBase.startsWith('{')) {
        const parsed = JSON.parse(customPromptBase)
        if (parsed.ai_model_name) selectedModel = parsed.ai_model_name
      }
    } catch (e) {}

    // Remap all deprecated/discontinued models to a working one
    const DEPRECATED_MODELS = [
      'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-001',
      'gemini-2.5-flash', 'gemini-2.5-flash-001',
      'gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.5-pro',
      'gemini-pro', 'gemini-ultra'
    ]
    if (DEPRECATED_MODELS.includes(selectedModel) || !selectedModel.startsWith('gemini-')) {
      console.warn(`[async-ai-reply] Model "${selectedModel}" is deprecated or invalid. Falling back to gemini-flash-lite-latest.`)
      selectedModel = 'gemini-flash-lite-latest'
    }
    if (selectedModel === 'gemini-3.1-flash-lite' || selectedModel === 'gemini-3.1-flash-lite-preview') {
      selectedModel = 'gemini-3.1-flash-lite-preview'
    }

    console.log(`[async-ai-reply] Calling Gemini model "${selectedModel}"...`)

    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${tenantAiKey}`, {
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

    // Retry with working gemini-flash-lite-latest if initial model returns 404 or fails
    if (!response.ok && selectedModel !== 'gemini-flash-lite-latest') {
      console.warn(`[async-ai-reply] Model ${selectedModel} failed (${response.status}). Retrying with gemini-flash-lite-latest...`)
      selectedModel = 'gemini-flash-lite-latest'
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${tenantAiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `Recent chat history:\n${chatContext}\n\nAnalyze the customer's last message and generate the JSON response.` }] }],
          systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      })
    }

    if (!response.ok) {
      throw new Error(`Gemini error (${response.status}): ${await response.text()}`)
    }

    const aiData = await response.json()
    const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const content = JSON.parse(rawText)
    
    // 4. Update Lead Score & Temperature
    const scoreAdj = content.scoreAdjustment || 0
    let baselineScore = lead?.lead_score || 0
    if (baselineScore === 0 && scoreAdj !== -100) {
      baselineScore = 40 // Baseline score for active conversation
    }

    const computedScore = scoreAdj === -100 ? 0 : Math.max(0, Math.min(100, baselineScore + scoreAdj))
    const newScore = computedScore
    
    let newTemp = 'WARM'
    if (scoreAdj === -100) newTemp = 'SUPPRESSED'
    else if (newScore >= 70) newTemp = 'HOT'
    else if (newScore >= 40) newTemp = 'WARM'
    else newTemp = 'COLD'

    const filteredAiContent = { ...content }
    delete filteredAiContent.replyMessage
    delete filteredAiContent.scoreAdjustment
    delete filteredAiContent.reasoning
    
    const newMetadata = { ...metadata, ...filteredAiContent, timeline: content.extractedTimeline || metadata.timeline }
    
    // Non-blocking lead score & temperature update in background
    if (lead?.id) {
      (async () => {
        try {
          // Move deleted columns into metadata to prevent DB schema errors
          newMetadata.lead_score = newScore;
          newMetadata.lead_quality = newTemp.toLowerCase();
          
          await supabaseAdmin
            .from('leads')
            .update({
              lead_temperature: newTemp,
              metadata: newMetadata,
              updated_at: new Date().toISOString()
            })
            .eq('id', lead.id)
        } catch (e) {
          console.error('[async-ai-reply] Lead update background error:', e)
        }
      })()
    }

    // 5. Fast Direct Meta Dispatch (skips internal HTTP loop to /api/reply)
    if (content.replyMessage) {
      const whatsapp_token = orgSettings?.whatsapp_token
      const active_phone_id = conv?.provider_phone_id || orgSettings?.whatsapp_phone_id

      if (whatsapp_token && active_phone_id) {
        console.log(`[async-ai-reply:fast-path] Direct Meta WhatsApp dispatch for org ${orgId}...`)
        const timestamp = new Date().toISOString()
        
        // Save outgoing message to DB & update conversation
        const [msgRes] = await Promise.all([
          supabaseAdmin
            .from('messages')
            .insert({
              conversation_id,
              org_id: orgId,
              phone_number,
              message: content.replyMessage,
              direction: 'outgoing',
              timestamp,
              platform: 'whatsapp'
            })
            .select()
            .single(),
          supabaseAdmin
            .from('conversations')
            .update({ last_message: content.replyMessage, updated_at: timestamp })
            .eq('id', conversation_id)
            .eq('org_id', orgId)
        ])

        const msg = msgRes.data

        // Dispatch directly to Meta Graph API
        const metaRes = await fetch(`https://graph.facebook.com/v20.0/${active_phone_id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsapp_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone_number.replace('+', ''),
            type: 'text',
            text: { body: content.replyMessage }
          })
        })

        if (metaRes.ok) {
          const metaData = await metaRes.json()
          const wamid = metaData?.messages?.[0]?.id
          if (wamid && msg?.id) {
            await supabaseAdmin.from('messages').update({ provider_message_id: wamid }).eq('id', msg.id)
          }
          console.log(`[async-ai-reply:fast-path] ✅ Direct Meta reply sent! wamid: ${wamid}`)

          // Schedule 6-Hour Automated Follow-Up for leads that are not qualified/suppressed
          if (lead?.id && lead.lead_temperature !== 'SUPPRESSED') {
            const isQualifiedStage = ['confirmed', 'booking', 'completed', 'hot_customer', 'not_interested'].includes(lead.stage || '')
            if (!isQualifiedStage) {
              const sixHoursLater = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
              await supabaseAdmin.from('leads').update({
                followup_date: sixHoursLater,
                followup_notes: '[Automated 6-Hour Follow-up Scheduled]',
                followup_notified: false
              }).eq('id', lead.id)
            }
          }
        } else {
          console.error(`[async-ai-reply:fast-path] Meta API error:`, await metaRes.text())
        }
      } else {
        // Fallback to internal route if direct credentials missing
        const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://voxaiagents.com'
        console.log(`[async-ai-reply] Dispatching AI reply to ${origin}/api/reply...`)
        await fetch(`${origin}/api/reply`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.N8N_WEBHOOK_SECRET || 'internal-ai-reply'
          },
          body: JSON.stringify({
            conversation_id,
            phone_number,
            org_id: orgId,
            message: content.replyMessage
          })
        }).catch(err => console.error('[async-ai-reply] Error calling /api/reply:', err))
      }
    }

    // 6. If HOT, Trigger Human Handover Task natively
    if (newTemp === 'HOT' && lead?.lead_temperature !== 'HOT') {
      (async () => {
        try {
          if (lead?.id) {
            await supabaseAdmin.from('lead_activities').insert({
              lead_id: lead.id,
              activity_type: 'human_handover',
              description: 'Lead reached HOT status. Human Handover Required.',
              notes: `Reason: ${content.reasoning || 'AI Scoring threshold met.'}\nScore: ${newScore}\nTimeline: ${content.extractedTimeline || 'Unknown'}`
            })
          }
          
          await supabaseAdmin.from('workflow_instances')
            .update({ status: 'completed' })
            .eq('phone_number', phone_number)
            .eq('org_id', orgId)
        } catch (e) {}
      })()

      console.log(`[async-ai-reply] Lead ${phone_number} reached HOT. Human Handover task created and automation stopped.`)
    }

    return NextResponse.json({ success: true, newScore, newTemp })

  } catch (err: any) {
    console.error('[async-ai-reply] Error:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
