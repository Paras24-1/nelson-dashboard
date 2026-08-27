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
    const allowedKeys = [
      'whatsapp_token',
      'whatsapp_phone_id',
      'whatsapp_waba_id',
      'n8n_inbound_webhook_url',
      'n8n_webhook_url',
      'n8n_reply_webhook_url',
      'n8n_calendar_webhook_url',
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

    const calWebhook = body.n8n_calendar_webhook_url !== undefined ? (body.n8n_calendar_webhook_url || '') : null

    // Check if settings row already exists for this org
    const { data: existing } = await supabaseAdmin
      .from('organization_settings')
      .select('id, ai_system_prompt, n8n_calendar_webhook_url')
      .eq('org_id', orgId)
      .maybeSingle()

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

    let { data, error } = await query.select().single()

    // If SQL column 'n8n_calendar_webhook_url' does not exist in Supabase schema, handle fallback
    if (error) {
      delete filtered.n8n_calendar_webhook_url

      if (calWebhook !== null) {
        let prompt = body.ai_system_prompt !== undefined ? (body.ai_system_prompt || '') : (existing?.ai_system_prompt || '')
        if (prompt.includes('__N8N_CALENDAR_WEBHOOK__=')) {
          prompt = prompt.replace(/__N8N_CALENDAR_WEBHOOK__=[\s\S]*?__END_WEBHOOK__/g, '').trim()
        }
        if (calWebhook) {
          prompt = prompt ? `${prompt}\n__N8N_CALENDAR_WEBHOOK__=${calWebhook}__END_WEBHOOK__` : `__N8N_CALENDAR_WEBHOOK__=${calWebhook}__END_WEBHOOK__`
        }
        filtered.ai_system_prompt = prompt
      }

      let retryQuery
      if (existing) {
        retryQuery = supabaseAdmin
          .from('organization_settings')
          .update(filtered)
          .eq('org_id', orgId)
      } else {
        retryQuery = supabaseAdmin
          .from('organization_settings')
          .insert({ org_id: orgId, ...filtered })
      }

      const retryRes = await retryQuery.select().single()
      if (retryRes.error) {
        throw new Error(retryRes.error.message || String(retryRes.error))
      }
      data = retryRes.data
    }

    if (data && !data.n8n_calendar_webhook_url && calWebhook) {
      data.n8n_calendar_webhook_url = calWebhook
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[settings]', err)
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 })
  }
}
