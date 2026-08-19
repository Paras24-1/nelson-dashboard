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
    return NextResponse.json(data || {})
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
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
      'n8n_webhook_url',
      'n8n_reply_webhook_url',
      'google_sheet_id',
      'google_sheet_name',
      'google_sheets_api_key',
      'gemini_api_key',
      'openai_api_key',
      'ai_system_prompt'
    ]

    const filtered: Record<string, any> = {}
    for (const key of allowedKeys) {
      if (key in body) {
        filtered[key] = body[key] || null
      }
    }

    // Check if settings row already exists for this org
    const { data: existing } = await supabaseAdmin
      .from('organization_settings')
      .select('id')
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

    const { data, error } = await query.select().single()
    if (error) throw error

    return NextResponse.json(data)
  } catch (err) {
    console.error('[settings]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
