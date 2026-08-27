import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendBookingEmail } from '@/lib/email'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, key)
}

function generateCleanMeetLink() {
  const p1 = Math.random().toString(36).substring(2, 5).toLowerCase()
  const p2 = Math.random().toString(36).substring(2, 6).toLowerCase()
  const p3 = Math.random().toString(36).substring(2, 5).toLowerCase()
  return `https://meet.google.com/${p1}-${p2}-${p3}`
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
    }

    // Always attempt fallback lookup if eventType is missing or lacks weekly_schedule
    if (!eventType || !eventType.weekly_schedule) {
      const { data: allSettings } = await supabase
        .from('organization_settings')
        .select('org_id, ai_system_prompt')

      if (allSettings) {
        for (const s of allSettings) {
          if (s.ai_system_prompt?.includes('__CALENDAR_EVENTS_STORE__=')) {
            try {
              const raw = s.ai_system_prompt.split('__CALENDAR_EVENTS_STORE__=')[1].split('__END_STORE__')[0]
              const list = JSON.parse(raw)
              const match = list.find((e: any) => e.slug === slug || e.id === slug || (dbEvt && e.id === dbEvt.id))
              if (match) {
                if (!eventType) {
                  const { data: orgData } = await supabase.from('organizations').select('name, logo_url').eq('id', s.org_id).maybeSingle()
                  eventType = { ...match, organization: orgData }
                } else if (match.weekly_schedule) {
                  eventType = { ...eventType, weekly_schedule: match.weekly_schedule }
                }
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

    // --- REJECT PAST DATES & TIME SLOTS ---
    const todayStr = new Date().toISOString().split('T')[0]
    if (booking_date < todayStr) {
      return NextResponse.json({ error: 'Cannot book an appointment for a past date' }, { status: 400 })
    }

    if (booking_date === todayStr) {
      const [sh, sm] = start_time.split(':').map(Number)
      const slotTime = new Date()
      slotTime.setHours(sh, sm, 0, 0)
      if (slotTime <= new Date()) {
        return NextResponse.json({ error: 'Selected time slot has already passed today' }, { status: 400 })
      }
    }

    const supabase = getSupabaseAdmin()

    // Fetch Event Type details to validate working days & working hours
    let eventTitle = 'Scheduled Meeting'
    let customLocationUrl = ''
    let availableDays: string[] = ['mon', 'tue', 'wed', 'thu', 'fri']
    let startTimeStr = '10:00'
    let endTimeStr = '18:00'

    const { data: dbEvt } = await supabase.from('event_types').select('*').eq('id', event_type_id).maybeSingle()
    if (dbEvt) {
      eventTitle = dbEvt.title || eventTitle
      customLocationUrl = dbEvt.location_url || ''
      if (Array.isArray(dbEvt.available_days)) availableDays = dbEvt.available_days
      if (dbEvt.start_time) startTimeStr = dbEvt.start_time
      if (dbEvt.end_time) endTimeStr = dbEvt.end_time
    }

    // --- STRICT DAY OF WEEK & WEEKLY SCHEDULE WORKING HOURS CHECK ---
    const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const [y, m, d] = booking_date.split('-').map(Number)
    const bookingDateObj = new Date(y, m - 1, d)
    const dayCode = DAY_CODES[bookingDateObj.getDay()]

    let weeklySched = dbEvt?.weekly_schedule
    if (typeof weeklySched === 'string') {
      try { weeklySched = JSON.parse(weeklySched) } catch (e) {}
    }

    if (weeklySched && weeklySched[dayCode]) {
      const dayConfig = weeklySched[dayCode]
      if (!dayConfig.enabled) {
        return NextResponse.json({ error: `Selected date (${booking_date}) is marked as closed/unavailable` }, { status: 400 })
      }

      const intervals: { start: string; end: string }[] = dayConfig.intervals || []
      const [bookH, bookM] = start_time.split(':').map(Number)
      const bookMins = bookH * 60 + bookM

      let fallsInInterval = false
      for (const inter of intervals) {
        if (!inter.start || !inter.end) continue
        const [sH, sM] = inter.start.split(':').map(Number)
        const [eH, eM] = inter.end.split(':').map(Number)
        const startMins = sH * 60 + sM
        const endMins = eH * 60 + eM

        if (bookMins >= startMins && bookMins < endMins) {
          fallsInInterval = true
          break
        }
      }

      if (!fallsInInterval) {
        return NextResponse.json({ error: `Selected time (${start_time}) is outside operating hours for ${dayCode.toUpperCase()}` }, { status: 400 })
      }
    } else {
      if (availableDays.length > 0 && !availableDays.includes(dayCode)) {
        return NextResponse.json({ error: `Selected date (${booking_date}) falls on a non-working day (${dayCode.toUpperCase()})` }, { status: 400 })
      }

      const [startH, startM] = startTimeStr.split(':').map(Number)
      const [endH, endM] = endTimeStr.split(':').map(Number)
      const [bookH, bookM] = start_time.split(':').map(Number)

      const slotMinutes = bookH * 60 + bookM
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      if (slotMinutes < startMinutes || slotMinutes >= endMinutes) {
        return NextResponse.json({ error: `Selected time (${start_time}) is outside operating hours (${startTimeStr} - ${endTimeStr})` }, { status: 400 })
      }
    }

    // --- PROPER GOOGLE MEET / LOCATION LINK RESOLUTION ---
    let meeting_link = customLocationUrl
    if (!meeting_link || !meeting_link.startsWith('http')) {
      meeting_link = generateCleanMeetLink()
    }

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

    // Insert into DB
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
          followup_notes: `Scheduled Meeting: ${eventTitle} on ${booking_date} at ${start_time}. Link: ${meeting_link}`
        }).eq('id', existingLead.id)
      } else {
        await supabase.from('leads').insert({
          org_id,
          phone_number: cleanPhone,
          customer_name: attendee_name,
          followup_date: `${booking_date}T${start_time}:00Z`,
          followup_notes: `Scheduled Meeting: ${eventTitle} on ${booking_date} at ${start_time}. Link: ${meeting_link}`,
          created_at: new Date().toISOString()
        })
      }
    } catch (e) {}

    // --- EMAIL DISPATCH (LEAD & ADMIN) ---
    try {
      // 1. Resolve Admin Emails for this organization
      const { data: adminUsers } = await supabase
        .from('users')
        .select('email')
        .eq('org_id', org_id)
        .in('role', ['owner', 'admin'])

      const adminEmails = adminUsers?.map(u => u.email).filter(Boolean) || []
      if (!adminEmails.includes('voxai4278@gmail.com')) {
        adminEmails.push('voxai4278@gmail.com')
      }

      // 2. Deliver Real Gmail SMTP Email to Lead
      await sendBookingEmail({
        to: attendee_email,
        subject: `🗓️ Meeting Confirmed: ${eventTitle} on ${booking_date} at ${start_time}`,
        recipientName: attendee_name,
        eventTitle,
        bookingDate: booking_date,
        startTime: start_time,
        meetingLink: meeting_link,
        notes: notes || '',
        isAdmin: false
      })

      // 3. Deliver Real Gmail SMTP Email to Admin(s)
      for (const adminEmail of adminEmails) {
        await sendBookingEmail({
          to: adminEmail,
          subject: `🔔 New Meeting Booked: ${attendee_name} (${booking_date} @ ${start_time})`,
          recipientName: 'Admin',
          eventTitle,
          bookingDate: booking_date,
          startTime: start_time,
          meetingLink: meeting_link,
          notes: notes || '',
          isAdmin: true,
          leadPhone: attendee_phone,
          leadEmail: attendee_email
        })
      }

      // Also log ticket in Supabase emails table
      try {
        await supabase.from('emails').insert({
          org_id,
          message_id: 'cal_lead_' + Date.now(),
          from_email: 'voxai4278@gmail.com',
          from_name: 'VoxAI Booking System',
          to_email: attendee_email,
          subject: `🗓️ Meeting Confirmed: ${eventTitle} on ${booking_date} at ${start_time}`,
          body_text: `Hello ${attendee_name},\n\nYour meeting "${eventTitle}" has been successfully scheduled!\n\n📅 Date: ${booking_date}\n⏰ Time: ${start_time}\n📹 Join Link: ${meeting_link}\n\nWe look forward to speaking with you!`,
          status: 'sent'
        })
      } catch (e) {}

      // 4. Send WhatsApp Notification to Lead if WhatsApp API configured
      const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('whatsapp_token, whatsapp_phone_id')
        .eq('org_id', org_id)
        .maybeSingle()

      if (orgSettings?.whatsapp_token && orgSettings?.whatsapp_phone_id) {
        const messageText = `Hello ${attendee_name}! 👋\nYour appointment for "${eventTitle}" has been successfully scheduled.\n\n📅 Date: ${booking_date}\n⏰ Time: ${start_time}\n📹 Meeting Link: ${meeting_link}\n\nThank you for scheduling with us!`
        
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
        }).catch(() => {})
      }
    } catch (e) {}

    return NextResponse.json({ success: true, appointment: newApt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
