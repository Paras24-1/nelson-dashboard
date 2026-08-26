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

    // Try dedicated event_types table first
    const { data: events, error } = await supabase
      .from('event_types')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (!error && events) {
      return NextResponse.json(events)
    }

    // Fallback to storage in organization_settings if table not present yet
    const { data: settings } = await supabase
      .from('organization_settings')
      .select('ai_system_prompt')
      .eq('org_id', orgId)
      .maybeSingle()

    let fallbackEvents: any[] = []
    if (settings?.ai_system_prompt?.includes('__CALENDAR_EVENTS_STORE__=')) {
      try {
        const raw = settings.ai_system_prompt.split('__CALENDAR_EVENTS_STORE__=')[1].split('__END_STORE__')[0]
        fallbackEvents = JSON.parse(raw)
      } catch (e) {}
    }

    return NextResponse.json(fallbackEvents)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, org_id, title, slug, description, duration_minutes, location_type, location_url, available_days, start_time, end_time, timezone, slot_interval, buffer_minutes, min_notice_hours, redirect_url } = body

    if (!org_id || !title) {
      return NextResponse.json({ error: 'org_id and title are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const eventSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'call'

    const payload = {
      org_id,
      title,
      slug: eventSlug,
      description: description || '',
      duration_minutes: Number(duration_minutes) || 30,
      location_type: location_type || 'google_meet',
      location_url: location_url || '',
      available_days: available_days || ['mon', 'tue', 'wed', 'thu', 'fri'],
      start_time: start_time || '10:00',
      end_time: end_time || '18:00',
      timezone: timezone || 'Asia/Kolkata',
      slot_interval: Number(slot_interval) || 30,
      buffer_minutes: Number(buffer_minutes) || 10,
      min_notice_hours: Number(min_notice_hours) || 4,
      redirect_url: redirect_url || '',
      is_active: true
    }

    // Try inserting into event_types table
    if (id) {
      const { data: updated, error: updateErr } = await supabase
        .from('event_types')
        .update(payload)
        .eq('id', id)
        .eq('org_id', org_id)
        .select()

      if (!updateErr && updated && updated.length > 0) {
        return NextResponse.json(updated[0])
      }
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from('event_types')
        .insert(payload)
        .select()

      if (!insertErr && inserted && inserted.length > 0) {
        return NextResponse.json(inserted[0])
      }
    }

    // Fallback store if table is missing
    const newEvt = {
      id: id || 'evt_' + Math.random().toString(36).substring(2, 9),
      created_at: new Date().toISOString(),
      ...payload
    }

    const { data: settings } = await supabase
      .from('organization_settings')
      .select('ai_system_prompt')
      .eq('org_id', org_id)
      .maybeSingle()

    let currentPrompt = settings?.ai_system_prompt || ''
    let eventsList: any[] = []

    if (currentPrompt.includes('__CALENDAR_EVENTS_STORE__=')) {
      try {
        const raw = currentPrompt.split('__CALENDAR_EVENTS_STORE__=')[1].split('__END_STORE__')[0]
        eventsList = JSON.parse(raw)
      } catch (e) {}
    }

    const existingIdx = eventsList.findIndex(e => e.id === newEvt.id || e.slug === newEvt.slug)
    if (existingIdx >= 0) {
      eventsList[existingIdx] = newEvt
    } else {
      eventsList.unshift(newEvt)
    }

    const storeTag = `__CALENDAR_EVENTS_STORE__=${JSON.stringify(eventsList)}__END_STORE__`
    let updatedPrompt = currentPrompt
    if (currentPrompt.includes('__CALENDAR_EVENTS_STORE__=')) {
      updatedPrompt = currentPrompt.replace(/__CALENDAR_EVENTS_STORE__=[\s\S]*?__END_STORE__/, storeTag)
    } else {
      updatedPrompt = (currentPrompt ? currentPrompt + '\n\n' : '') + storeTag
    }

    await supabase
      .from('organization_settings')
      .upsert({ org_id, ai_system_prompt: updatedPrompt }, { onConflict: 'org_id' })

    return NextResponse.json(newEvt)
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
      .from('event_types')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    // Also clean fallback store
    const { data: settings } = await supabase
      .from('organization_settings')
      .select('ai_system_prompt')
      .eq('org_id', orgId)
      .maybeSingle()

    if (settings?.ai_system_prompt?.includes('__CALENDAR_EVENTS_STORE__=')) {
      try {
        const currentPrompt = settings.ai_system_prompt
        const raw = currentPrompt.split('__CALENDAR_EVENTS_STORE__=')[1].split('__END_STORE__')[0]
        let eventsList = JSON.parse(raw).filter((e: any) => e.id !== id)
        const storeTag = `__CALENDAR_EVENTS_STORE__=${JSON.stringify(eventsList)}__END_STORE__`
        const updatedPrompt = currentPrompt.replace(/__CALENDAR_EVENTS_STORE__=[\s\S]*?__END_STORE__/, storeTag)
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
