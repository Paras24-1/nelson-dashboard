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

    const { data: orgSettings } = await supabaseAdmin
      .from('organization_settings')
      .select('gemini_api_key, ai_system_prompt, ai_knowledge_base_sheet_id, ai_knowledge_base_range, google_sheets_api_key')
      .eq('org_id', orgId)
      .maybeSingle()
    let tenantAiKey = orgSettings?.gemini_api_key
    if (!tenantAiKey && orgSettings?.ai_system_prompt?.startsWith('{')) {
      try {
        const parsed = JSON.parse(orgSettings.ai_system_prompt)
        if (parsed.gemini_api_key) tenantAiKey = parsed.gemini_api_key
      } catch (e) {}
    }
    
    // If tenant key is empty, fallback to system GEMINI_API_KEY
    if (!tenantAiKey || !tenantAiKey.trim()) {
      tenantAiKey = process.env.GEMINI_API_KEY || ''
    }

    if (!tenantAiKey) {
      console.warn('[async-ai-reply] No valid GEMINI_API_KEY found. Skipping AI reply.')
      return NextResponse.json({ error: 'No valid GEMINI_API_KEY' }, { status: 500 })
    }

    // 1. Fetch Lead context & metadata
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id, metadata, lead_score, lead_temperature, industry, name, assigned_to')
      .eq('phone_number', phone_number)
      .eq('org_id', orgId)
      .maybeSingle()

    // Fetch assigned employee name & phone if assigned
    let assignedEmployeeName = 'Unassigned'
    let assignedEmployeePhone = ''
    if (lead?.assigned_to) {
      const { data: emp } = await supabaseAdmin
        .from('users')
        .select('name, email, avatar')
        .eq('id', lead.assigned_to)
        .maybeSingle()
      if (emp) {
        assignedEmployeeName = emp.name || emp.email
        assignedEmployeePhone = (emp as any).phone_number || (emp.avatar && emp.avatar.startsWith('phone:') ? emp.avatar.replace('phone:', '') : '')
      }
    } else if (conversation_id) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('assigned_to')
        .eq('id', conversation_id)
        .maybeSingle()
      if (conv?.assigned_to) {
        const { data: emp } = await supabaseAdmin
          .from('users')
          .select('name, email, avatar')
          .eq('id', conv.assigned_to)
          .maybeSingle()
        if (emp) {
          assignedEmployeeName = emp.name || emp.email
          assignedEmployeePhone = (emp as any).phone_number || (emp.avatar && emp.avatar.startsWith('phone:') ? emp.avatar.replace('phone:', '') : '')
        }
      }
    }

    // Fallback to org owner/admin phone if unassigned or no phone on assigned employee
    if (!assignedEmployeePhone && orgId) {
      const { data: orgUsers } = await supabaseAdmin
        .from('users')
        .select('name, email, avatar, role')
        .eq('org_id', orgId)
        .limit(20)
      if (orgUsers && orgUsers.length > 0) {
        const userWithPhone = orgUsers.find(u => (u as any).phone_number || (u.avatar && typeof u.avatar === 'string' && u.avatar.startsWith('phone:')))
        if (userWithPhone) {
          assignedEmployeePhone = (userWithPhone as any).phone_number || (userWithPhone.avatar && userWithPhone.avatar.startsWith('phone:') ? userWithPhone.avatar.replace('phone:', '').trim() : '')
          if (assignedEmployeeName === 'Unassigned') {
            assignedEmployeeName = userWithPhone.name || userWithPhone.email
          }
        }
      }
    }

    // INTERCEPT & STOP AUTOMATED DRIPS
    // If the user replied, they are engaged! We must immediately cancel any pending automated outbound drip messages.
    if (lead) {
      try {
        await supabaseAdmin.from('scheduled_drips')
          .update({ status: 'cancelled' })
          .eq('lead_id', lead.id)
          .eq('status', 'pending')
          .then(({ error }) => {
             if (error && error.code !== 'PGRST205') console.error('[async-ai-reply] Failed to cancel drips:', error)
          })
      } catch (e) {}
    }
    
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
    
    // Optional Knowledge Base from Google Sheets
    let knowledgeBaseContext = ''
    if (orgSettings?.ai_knowledge_base_sheet_id) {
      try {
        const sheetId = orgSettings.ai_knowledge_base_sheet_id
        const range = orgSettings.ai_knowledge_base_range || 'Sheet1!A:Z'
        const apiKey = orgSettings.google_sheets_api_key || process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY
        
        if (apiKey) {
          const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
          const sheetRes = await fetch(sheetUrl, { next: { revalidate: 60 } }) // Cache for 60s
          
          if (sheetRes.ok) {
            const sheetData = await sheetRes.json()
            const rows = sheetData.values || []
            if (rows.length > 0) {
              const headers = rows[0].join(' | ')
              const dataRows = rows.slice(1).map((r: string[]) => r.join(' | ')).join('\n')
              knowledgeBaseContext = `\n\n--- KNOWLEDGE BASE (CATALOG / LINKS) ---\nUse the following table to answer questions. If the user asks for a demo, link, or price, look it up here:\nHeaders: ${headers}\n${dataRows}\n----------------------------------------\n`
            }
          } else {
            console.warn('[async-ai-reply] Failed to fetch Google Sheet', await sheetRes.text())
          }
        }
      } catch (err) {
        console.error('[async-ai-reply] Google Sheets error:', err)
      }
    }

    const systemPrompt = `${customPromptBase}${knowledgeBaseContext}
Context:
Customer Name: ${lead?.name || 'Unknown'}
Phone Number: ${phone_number}
Assigned Employee: ${assignedEmployeeName}
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

    // Parse active AI model name from settings
    let selectedModel = 'gemini-flash-lite-latest'
    try {
      if (customPromptBase && customPromptBase.startsWith('{')) {
        const parsed = JSON.parse(customPromptBase)
        if (parsed.ai_model_name) selectedModel = parsed.ai_model_name
      }
    } catch (e) {}

    // Map models to working Gemini 3.1 Flash Lite / flash-lite-latest
    if (selectedModel === '3.1-flash-lite' || selectedModel === 'gemini-3.1-flash-lite' || selectedModel === 'gemini-3.1-flash-lite-preview') {
      selectedModel = 'gemini-3.1-flash-lite-preview'
    } else if (!selectedModel.startsWith('gemini-')) {
      selectedModel = 'gemini-flash-lite-latest'
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
    
    // 4. Update Lead Score & Temperature natively
    const newScore = currentScore + (content.scoreAdjustment || 0)
    let newTemp = lead?.lead_temperature || 'COLD'
    
    if (content.scoreAdjustment === -100) newTemp = 'SUPPRESSED'
    else if (newScore >= 70) newTemp = 'HOT'
    else if (newScore >= 40) newTemp = 'WARM'
    else if (newScore >= 20) newTemp = 'COLD'
    else newTemp = 'COLD'

    // Save back to DB. We dynamically merge ALL keys the AI output (like state, industry, etc) into metadata!
    const filteredAiContent = { ...content }
    delete filteredAiContent.replyMessage
    delete filteredAiContent.scoreAdjustment
    delete filteredAiContent.reasoning
    
    const newMetadata = { ...metadata, ...filteredAiContent, timeline: content.extractedTimeline || metadata.timeline }
    
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
