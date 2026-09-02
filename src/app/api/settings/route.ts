import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('organization_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    if (error) throw error
    const result = data || {}

    // Parse fallback n8n_calendar_webhook_url if embedded in ai_system_prompt
    if (!result.n8n_calendar_webhook_url && result.ai_system_prompt?.includes('__N8N_CALENDAR_WEBHOOK__=')) {
      try {
        const raw = result.ai_system_prompt.split('__N8N_CALENDAR_WEBHOOK__=')[1].split('__END_WEBHOOK__')[0]
        result.n8n_calendar_webhook_url = raw
      } catch (e) {}
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()

    // Allowed columns that exist in Supabase organization_settings table
    const allowedKeys = [
      'whatsapp_token',
      'whatsapp_phone_id',
      'whatsapp_waba_id',
      'n8n_inbound_webhook_url',
      'n8n_webhook_url',
      'n8n_reply_webhook_url',
      'google_sheet_id',
      'google_sheet_name',
      'google_sheets_api_key',
      'gemini_api_key',
      'openai_api_key',
      'ai_system_prompt',
      'ai_knowledge_base_sheet_id',
      'ai_knowledge_base_range'
    ]

    const filtered: Record<string, any> = {}
    for (const key of allowedKeys) {
      if (key in body) {
        filtered[key] = body[key] || null
      }
    }

    const calWebhook = body.n8n_calendar_webhook_url !== undefined ? (body.n8n_calendar_webhook_url || '').trim() : null

    // Safely query existing settings using only guaranteed valid columns
    const { data: existing } = await supabaseAdmin
      .from('organization_settings')
      .select('id, ai_system_prompt, whatsapp_token, whatsapp_waba_id')
      .eq('org_id', orgId)
      .maybeSingle()

    // Handle embedding n8n_calendar_webhook_url safely inside ai_system_prompt tag
    if (calWebhook !== null) {
      let prompt = filtered.ai_system_prompt !== undefined ? (filtered.ai_system_prompt || '') : (existing?.ai_system_prompt || '')
      if (prompt.includes('__N8N_CALENDAR_WEBHOOK__=')) {
        prompt = prompt.replace(/__N8N_CALENDAR_WEBHOOK__=[\s\S]*?__END_WEBHOOK__/g, '').trim()
      }
      if (calWebhook) {
        prompt = prompt ? `${prompt}\n__N8N_CALENDAR_WEBHOOK__=${calWebhook}__END_WEBHOOK__` : `__N8N_CALENDAR_WEBHOOK__=${calWebhook}__END_WEBHOOK__`
      }
      filtered.ai_system_prompt = prompt
    }

    let query
    if (existing) {
      query = supabaseAdmin
        .from('organization_settings')
        .update(filtered)
        .eq('org_id', orgId)
    } else {
      query = supabaseAdmin
        .from('organization_settings')
        .insert({ org_id: orgId, ...filtered })
    }

    const { data, error } = await query.select().single()
    if (error) {
      console.error('[settings save error]', error)
      throw new Error(error.message || String(error))
    }

    // Auto-subscribe WABA to Meta App webhook whenever WhatsApp credentials are saved/updated
    // This ensures Meta delivers webhooks to voxaiagents.com for this org's phone number
    const finalToken = filtered.whatsapp_token || existing?.whatsapp_token
    const finalWabaId = filtered.whatsapp_waba_id || existing?.whatsapp_waba_id
    const credentialsChanged = 'whatsapp_token' in filtered || 'whatsapp_waba_id' in filtered || 'whatsapp_phone_id' in filtered

    if (credentialsChanged && finalToken && finalWabaId) {
      try {
        console.log(`[settings] Auto-subscribing WABA ${finalWabaId} to Meta App webhook...`)
        const subRes = await fetch(`https://graph.facebook.com/v20.0/${finalWabaId}/subscribed_apps`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${finalToken}`,
            'Content-Type': 'application/json'
          }
        })
        const subData = await subRes.json()
        if (subRes.ok && subData.success) {
          console.log(`[settings] ✅ WABA ${finalWabaId} successfully subscribed to webhook`)
        } else {
          console.warn(`[settings] ⚠️ WABA webhook subscription failed:`, JSON.stringify(subData))
        }
      } catch (subErr) {
        console.warn(`[settings] ⚠️ Could not auto-subscribe WABA webhook:`, subErr)
      }
    }

    const resObj = { ...data, n8n_calendar_webhook_url: calWebhook !== null ? calWebhook : '' }
    return NextResponse.json(resObj)
  } catch (err: any) {
    console.error('[settings]', err)
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 })
  }
}
