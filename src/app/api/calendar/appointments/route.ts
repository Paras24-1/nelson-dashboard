import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, key)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Try dedicated booking_appointments table
    const { data: appointments, error } = await supabase
      .from('booking_appointments')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (!error && appointments) {
      return NextResponse.json(appointments)
    }

    // Fallback store
    const { data: settings } = await supabase
      .from('organization_settings')
      .select('ai_system_prompt')
      .eq('org_id', orgId)
      .maybeSingle()

    let fallbackApts: any[] = []
    if (settings?.ai_system_prompt?.includes('__CALENDAR_APPOINTMENTS_STORE__=')) {
      try {
        const raw = settings.ai_system_prompt.split('__CALENDAR_APPOINTMENTS_STORE__=')[1].split('__END_STORE__')[0]
        fallbackApts = JSON.parse(raw)
      } catch (e) {}
    }

    return NextResponse.json(fallbackApts)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const orgId = searchParams.get('org_id')

    if (!id || !orgId) {
      return NextResponse.json({ error: 'id and org_id are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    await supabase
      .from('booking_appointments')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    const { data: settings } = await supabase
      .from('organization_settings')
      .select('ai_system_prompt')
      .eq('org_id', orgId)
      .maybeSingle()

    if (settings?.ai_system_prompt?.includes('__CALENDAR_APPOINTMENTS_STORE__=')) {
      try {
        const currentPrompt = settings.ai_system_prompt
        const raw = currentPrompt.split('__CALENDAR_APPOINTMENTS_STORE__=')[1].split('__END_STORE__')[0]
        let aptsList = JSON.parse(raw).filter((a: any) => a.id !== id)
        const storeTag = `__CALENDAR_APPOINTMENTS_STORE__=${JSON.stringify(aptsList)}__END_STORE__`
        const updatedPrompt = currentPrompt.replace(/__CALENDAR_APPOINTMENTS_STORE__=[\s\S]*?__END_STORE__/, storeTag)
        await supabase
          .from('organization_settings')
          .update({ ai_system_prompt: updatedPrompt })
          .eq('org_id', orgId)
      } catch (e) {}
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
