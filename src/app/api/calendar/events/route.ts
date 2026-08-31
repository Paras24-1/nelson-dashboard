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

    // 1. Fetch fallback store from organization_settings
    const { data: settings } = await supabase
      .from('organization_settings')
      .select('ai_system_prompt')
      .eq('org_id', orgId)
      .maybeSingle()

    let fallbackEventsList: any[] = []
    if (settings?.ai_system_prompt?.includes('__CALENDAR_EVENTS_STORE__=')) {
      try {
        const raw = settings.ai_system_prompt.split('__CALENDAR_EVENTS_STORE__=')[1].split('__END_STORE__')[0]
        fallbackEventsList = JSON.parse(raw)
      } catch (e) {}
    }

    const fallbackEventsMap = new Map<string, any>()
    fallbackEventsList.forEach(e => {
      const key = e.id || e.slug
      if (key && !fallbackEventsMap.has(key)) {
        fallbackEventsMap.set(key, e)
      }
    })

    // 2. Try dedicated event_types table
    const { data: events, error } = await supabase
      .from('event_types')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (!error && events && events.length > 0) {
      // Merge weekly_schedule from fallback store if column was missing in DB table, deduplicating by slug/id
      const uniqueEventsMap = new Map()
      events.forEach(evt => {
        if (!uniqueEventsMap.has(evt.slug) && !uniqueEventsMap.has(evt.id)) {
          const fallbackMatch = fallbackEventsMap.get(evt.id) || fallbackEventsMap.get(evt.slug)
          uniqueEventsMap.set(evt.id, {
            ...evt,
            weekly_schedule: evt.weekly_schedule || fallbackMatch?.weekly_schedule || null
          })
        }
      })
      return NextResponse.json(Array.from(uniqueEventsMap.values()))
    }

    return NextResponse.json(Array.from(fallbackEventsMap.values()))
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      id, org_id, title, slug, description, duration_minutes, location_type, location_url, 
      available_days, weekly_schedule, start_time, end_time, timezone, slot_interval, 
      buffer_minutes, min_notice_hours, redirect_url, n8n_calendar_webhook_url, url_prefix
    } = body

    if (!org_id || !title) {
      return NextResponse.json({ error: 'org_id and title are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    let eventSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'call'
    const targetId = id || 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)

    if (!id) {
      const { data: existingSlug } = await supabase
        .from('event_types')
        .select('id')
        .eq('org_id', org_id)
        .eq('slug', eventSlug)
        .maybeSingle()

      if (existingSlug) {
        eventSlug = `${eventSlug}-${Math.random().toString(36).substring(2, 6)}`
      }
    }

    const payload = {
      id: targetId,
      org_id,
      title,
      slug: eventSlug,
      url_prefix: url_prefix || 'book',
      description: description || '',
      duration_minutes: Number(duration_minutes) || 30,
      location_type: location_type || 'google_meet',
      location_url: location_url || '',
      available_days: available_days || ['mon', 'tue', 'wed', 'thu', 'fri'],
      weekly_schedule: weekly_schedule || null,
      start_time: start_time || '10:00',
      end_time: end_time || '18:00',
      timezone: timezone || 'Asia/Kolkata',
      slot_interval: Number(slot_interval) || 30,
      buffer_minutes: Number(buffer_minutes) || 10,
      min_notice_hours: Number(min_notice_hours) || 4,
      redirect_url: redirect_url || '',
      n8n_calendar_webhook_url: n8n_calendar_webhook_url || '',
      is_active: true
    }

    let savedResult = null

    // 1. Atomic upsert to DB table to prevent duplicate inserts
    try {
      const { data: upserted, error: upsertErr } = await supabase
        .from('event_types')
        .upsert(payload, { onConflict: 'id' })
        .select()

      if (!upsertErr && upserted && upserted.length > 0) {
        savedResult = upserted[0]
      } else if (upsertErr) {
        // If weekly_schedule column missing in SQL schema, upsert without it
        const { weekly_schedule: _, n8n_calendar_webhook_url: __, ...payloadClean } = payload
        const { data: fallbackUpsert } = await supabase
          .from('event_types')
          .upsert(payloadClean, { onConflict: 'id' })
          .select()
        if (fallbackUpsert && fallbackUpsert.length > 0) {
          savedResult = { ...fallbackUpsert[0], weekly_schedule, n8n_calendar_webhook_url }
        }
      }
    } catch (e) {}

    // 2. ALWAYS sync to organization_settings fallback store to guarantee persistence
    const finalEvt = savedResult || {
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

    const existingIdx = eventsList.findIndex(e => e.id === finalEvt.id || e.slug === finalEvt.slug)
    if (existingIdx >= 0) {
      eventsList[existingIdx] = finalEvt
    } else {
      eventsList.unshift(finalEvt)
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

    return NextResponse.json(finalEvt)
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
      .or(`id.eq.${id},slug.eq.${id}`)
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
        let eventsList = JSON.parse(raw).filter((e: any) => e.id !== id && e.slug !== id)
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
