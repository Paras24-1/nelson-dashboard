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
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Query event type by slug from DB table
    let eventType: any = null
    const { data: dbEvt } = await supabase
      .from('event_types')
      .select('*, organization:organizations(name, logo_url)')
      .eq('slug', slug)
      .maybeSingle()

    if (dbEvt) {
      eventType = dbEvt
    } else {
      // Fallback search across org_settings
      const { data: allSettings } = await supabase
        .from('organization_settings')
        .select('org_id, ai_system_prompt')

      if (allSettings) {
        for (const s of allSettings) {
          if (s.ai_system_prompt?.includes('__CALENDAR_EVENTS_STORE__=')) {
            try {
              const raw = s.ai_system_prompt.split('__CALENDAR_EVENTS_STORE__=')[1].split('__END_STORE__')[0]
              const list = JSON.parse(raw)
              const match = list.find((e: any) => e.slug === slug || e.id === slug)
              if (match) {
                const { data: orgData } = await supabase.from('organizations').select('name, logo_url').eq('id', s.org_id).maybeSingle()
                eventType = { ...match, organization: orgData }
                break
              }
            } catch (e) {}
          }
        }
      }
    }

    if (!eventType) {
      return NextResponse.json({ error: 'Event calendar not found' }, { status: 404 })
    }

    // Fetch existing appointments for this event
    let appointments: any[] = []
    const { data: dbApts } = await supabase
      .from('booking_appointments')
      .select('booking_date, start_time, end_time')
      .eq('event_type_id', eventType.id)
      .eq('status', 'confirmed')

    if (dbApts) {
      appointments = dbApts
    } else {
      const { data: sData } = await supabase
        .from('organization_settings')
        .select('ai_system_prompt')
        .eq('org_id', eventType.org_id)
        .maybeSingle()

      if (sData?.ai_system_prompt?.includes('__CALENDAR_APPOINTMENTS_STORE__=')) {
        try {
          const raw = sData.ai_system_prompt.split('__CALENDAR_APPOINTMENTS_STORE__=')[1].split('__END_STORE__')[0]
          appointments = JSON.parse(raw).filter((a: any) => a.event_type_id === eventType.id && a.status === 'confirmed')
        } catch (e) {}
      }
    }

    return NextResponse.json({ eventType, appointments })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { event_type_id, org_id, attendee_name, attendee_email, attendee_phone, booking_date, start_time, end_time, notes } = body

    if (!event_type_id || !org_id || !attendee_name || !attendee_email || !attendee_phone || !booking_date || !start_time) {
      return NextResponse.json({ error: 'All booking fields are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Generate meeting link (Google Meet / Zoom mock link)
    const meetId = Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5)
    const meeting_link = body.meeting_link || `https://meet.google.com/${meetId}`

    const newApt = {
      id: 'apt_' + Math.random().toString(36).substring(2, 9),
      event_type_id,
      org_id,
      attendee_name,
      attendee_email,
      attendee_phone,
      notes: notes || '',
      booking_date,
      start_time,
      end_time: end_time || start_time,
      status: 'confirmed',
      meeting_link,
      created_at: new Date().toISOString()
    }

    // Try inserting into DB
    const { data: inserted, error: insertErr } = await supabase
      .from('booking_appointments')
      .insert({
        event_type_id,
        org_id,
        attendee_name,
        attendee_email,
        attendee_phone,
        notes: notes || '',
        booking_date,
        start_time,
        end_time: end_time || start_time,
        status: 'confirmed',
        meeting_link
      })
      .select()

    if (!insertErr && inserted && inserted.length > 0) {
      newApt.id = inserted[0].id
    } else {
      // Fallback store
      const { data: sData } = await supabase
        .from('organization_settings')
        .select('ai_system_prompt')
        .eq('org_id', org_id)
        .maybeSingle()

      let currentPrompt = sData?.ai_system_prompt || ''
      let aptsList: any[] = []

      if (currentPrompt.includes('__CALENDAR_APPOINTMENTS_STORE__=')) {
        try {
          const raw = currentPrompt.split('__CALENDAR_APPOINTMENTS_STORE__=')[1].split('__END_STORE__')[0]
          aptsList = JSON.parse(raw)
        } catch (e) {}
      }

      aptsList.unshift(newApt)
      const storeTag = `__CALENDAR_APPOINTMENTS_STORE__=${JSON.stringify(aptsList)}__END_STORE__`

      let updatedPrompt = currentPrompt
      if (currentPrompt.includes('__CALENDAR_APPOINTMENTS_STORE__=')) {
        updatedPrompt = currentPrompt.replace(/__CALENDAR_APPOINTMENTS_STORE__=[\s\S]*?__END_STORE__/, storeTag)
      } else {
        updatedPrompt = (currentPrompt ? currentPrompt + '\n\n' : '') + storeTag
      }

      await supabase
        .from('organization_settings')
        .upsert({ org_id, ai_system_prompt: updatedPrompt }, { onConflict: 'org_id' })
    }

    // Auto-create or update lead record in leads table
    try {
      const cleanPhone = attendee_phone.replace(/[^0-9]/g, '')
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('org_id', org_id)
        .eq('phone_number', cleanPhone)
        .maybeSingle()

      if (existingLead) {
        await supabase.from('leads').update({
          customer_name: attendee_name,
          followup_date: `${booking_date}T${start_time}:00Z`,
          followup_notes: `Scheduled Meeting at ${start_time}. Link: ${meeting_link}`
        }).eq('id', existingLead.id)
      } else {
        await supabase.from('leads').insert({
          org_id,
          phone_number: cleanPhone,
          customer_name: attendee_name,
          followup_date: `${booking_date}T${start_time}:00Z`,
          followup_notes: `Scheduled Meeting at ${start_time}. Link: ${meeting_link}`,
          created_at: new Date().toISOString()
        })
      }
    } catch (e) {}

    // Send WhatsApp notification to lead if WhatsApp API is configured
    try {
      const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('whatsapp_token, whatsapp_phone_id')
        .eq('org_id', org_id)
        .maybeSingle()

      if (orgSettings?.whatsapp_token && orgSettings?.whatsapp_phone_id) {
        const messageText = `Hello ${attendee_name}! 👋\nYour appointment has been successfully scheduled.\n\n📅 Date: ${booking_date}\n⏰ Time: ${start_time}\n📹 Join Link: ${meeting_link}\n\nThank you for scheduling with us!`
        
        await fetch(`https://graph.facebook.com/v19.0/${orgSettings.whatsapp_phone_id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${orgSettings.whatsapp_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: attendee_phone.replace(/[^0-9]/g, ''),
            type: 'text',
            text: { body: messageText }
          })
        })
      }
    } catch (e) {}

    return NextResponse.json({ success: true, appointment: newApt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
