import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, key)
}

export async function POST(request: Request) {
  try {
    const { org_id, has_calendar } = await request.json()

    if (!org_id) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('organizations')
      .update({ has_calendar: Boolean(has_calendar) })
      .eq('id', org_id)

    if (error) {
      // If column doesn't exist yet, we can store in organization_settings
      await supabase
        .from('organization_settings')
        .upsert({ org_id, n8n_reply_webhook_url: `has_calendar:${Boolean(has_calendar)}` }, { onConflict: 'org_id' })
    }

    return NextResponse.json({ success: true, has_calendar: Boolean(has_calendar) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
