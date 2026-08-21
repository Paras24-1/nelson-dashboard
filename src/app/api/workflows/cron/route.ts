import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    // Basic security for the cron endpoint
    const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('Authorization')?.replace('Bearer ', '')
    if (secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch pending drips that are due to be sent
    const { data: pendingDrips, error: fetchError } = await supabaseAdmin
      .from('scheduled_drips')
      .select('*, leads(*)')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50) // Process in batches

    if (fetchError) throw fetchError
    if (!pendingDrips || pendingDrips.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending drips due.' })
    }

    const processed = []
    
    // Nurture Sequence Configuration (Days to wait after Day 0)
    // Step 1 is Day 0 (handled at enrollment). Step 2 is Day 2, Step 3 is Day 5...
    const dripTimelineDays = {
      1: 0,
      2: 2,
      3: 5,
      4: 9,
      5: 15,
      6: 23,
      7: 35
    }

    for (const drip of pendingDrips) {
      const lead = drip.leads
      if (!lead) {
        // Orphaned drip
        await supabaseAdmin.from('scheduled_drips').update({ status: 'cancelled' }).eq('id', drip.id)
        continue
      }

      // If lead is suppressed, cancel the drip automatically
      if (lead.lead_temperature === 'SUPPRESSED') {
        await supabaseAdmin.from('scheduled_drips').update({ status: 'cancelled' }).eq('id', drip.id)
        continue
      }

      const templateName = `nurture_step_${drip.touch_step}` // e.g. nurture_step_2

      // 2. Send the message via our internal Meta API Trigger
      const res = await fetch(`${req.nextUrl.origin}/api/conversations/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.N8N_WEBHOOK_SECRET || ''
        },
        body: JSON.stringify({
          phone: drip.phone_number,
          name: lead.name || 'there',
          template_name: templateName,
          template_lang: 'en',
          variables: [lead.name || 'there'],
          message_text: `[Drip Step ${drip.touch_step}] Auto-sent nurture message to ${lead.name}`,
          org_id: drip.org_id
        })
      })

      if (res.ok) {
        // Mark as sent
        await supabaseAdmin.from('scheduled_drips').update({ status: 'sent' }).eq('id', drip.id)
        
        // Schedule the NEXT step if there is one (up to 7 steps)
        const nextStep = drip.touch_step + 1
        if (nextStep <= 7 && dripTimelineDays[nextStep as keyof typeof dripTimelineDays]) {
          const daysToAdd = dripTimelineDays[nextStep as keyof typeof dripTimelineDays] - dripTimelineDays[drip.touch_step as keyof typeof dripTimelineDays]
          
          const nextDate = new Date()
          nextDate.setDate(nextDate.getDate() + daysToAdd)
          
          await supabaseAdmin.from('scheduled_drips').insert({
            lead_id: drip.lead_id,
            org_id: drip.org_id,
            phone_number: drip.phone_number,
            touch_step: nextStep,
            scheduled_for: nextDate.toISOString(),
            status: 'pending'
          })
        }
        processed.push({ id: drip.id, status: 'sent' })
      } else {
        console.error(`Failed to send drip step ${drip.touch_step} for lead ${lead.id}`)
        // Leave as pending so it retries on next cron tick, or mark failed depending on logic. We'll leave pending.
      }
    }

    return NextResponse.json({ success: true, processed })

  } catch (error: any) {
    console.error('[CRON API Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
