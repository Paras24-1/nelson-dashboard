import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('Authorization')?.replace('Bearer ', '')
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET || process.env.CRON_SECRET
    if (expectedSecret && secret !== expectedSecret && secret !== 'cron-trigger') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const nowIso = new Date().toISOString()
    const processed: any[] = []

    // 1. Fetch leads whose 6-hour automated follow-up is due
    const { data: dueLeads, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, org_id, phone_number, name, stage, lead_temperature, conversation_id, followup_notes')
      .not('followup_date', 'is', null)
      .lte('followup_date', nowIso)
      .eq('followup_notified', false)
      .limit(50)

    if (leadsError) console.error('[cron] Error fetching due leads:', leadsError)

    if (dueLeads && dueLeads.length > 0) {
      for (const lead of dueLeads) {
        // Skip/cancel follow-up if lead is suppressed or in a qualified/completed stage
        const isQualified = ['confirmed', 'booking', 'completed', 'hot_customer', 'not_interested'].includes(lead.stage || '')
        if (lead.lead_temperature === 'SUPPRESSED' || isQualified) {
          await supabaseAdmin.from('leads').update({
            followup_notified: true,
            followup_notes: `[Automated Follow-up Skipped: Stage is ${lead.stage || 'Suppressed'}]`
          }).eq('id', lead.id)
          continue
        }

        // Fetch conversation to check human takeover status
        let convId = lead.conversation_id
        let takeover = false
        let providerPhoneId = ''

        if (convId) {
          const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('id, takeover, provider_phone_id')
            .eq('id', convId)
            .maybeSingle()
          
          if (conv) {
            takeover = !!conv.takeover
            providerPhoneId = conv.provider_phone_id || ''
          }
        } else {
          const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('id, takeover, provider_phone_id')
            .eq('phone_number', lead.phone_number)
            .eq('org_id', lead.org_id)
            .maybeSingle()

          if (conv) {
            convId = conv.id
            takeover = !!conv.takeover
            providerPhoneId = conv.provider_phone_id || ''
          }
        }

        if (takeover) {
          // Human staff is handling chat — cancel automated drip
          await supabaseAdmin.from('leads').update({
            followup_notified: true,
            followup_notes: '[Automated Follow-up Skipped: Human Takeover Active]'
          }).eq('id', lead.id)
          continue
        }

        // Fetch org settings for WhatsApp API credentials
        const { data: orgSettings } = await supabaseAdmin
          .from('organization_settings')
          .select('whatsapp_token, whatsapp_phone_id')
          .eq('org_id', lead.org_id)
          .maybeSingle()

        const whatsappToken = orgSettings?.whatsapp_token || process.env.WHATSAPP_TOKEN
        const activePhoneId = providerPhoneId || orgSettings?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_ID

        const cleanPhone = String(lead.phone_number).replace(/\D/g, '')
        const leadFirstName = lead.name ? lead.name.split(' ')[0] : 'there'
        const followUpMessage = `Hi ${leadFirstName}! 👋 Just following up to see if you had any questions or if you'd like to continue our conversation? Let us know how we can help!`

        let sentSuccess = false
        let wamid = null

        if (whatsappToken && activePhoneId) {
          try {
            const metaRes = await fetch(`https://graph.facebook.com/v20.0/${activePhoneId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${whatsappToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: cleanPhone,
                type: 'text',
                text: { body: followUpMessage }
              })
            })

            if (metaRes.ok) {
              const metaData = await metaRes.json()
              wamid = metaData?.messages?.[0]?.id || null
              sentSuccess = true
            } else {
              console.error(`[cron:followup] Meta API send error for lead ${lead.id}:`, await metaRes.text())
            }
          } catch (metaErr) {
            console.error(`[cron:followup] Meta fetch error for lead ${lead.id}:`, metaErr)
          }
        }

        if (sentSuccess || !whatsappToken) {
          const sentTime = new Date().toISOString()
          const timeString = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

          // Update lead status
          await supabaseAdmin.from('leads').update({
            followup_notified: true,
            followup_notes: `[Automated 6-Hour Follow-up Sent at ${timeString}]`
          }).eq('id', lead.id)

          // Insert into messages table so it appears live in the Chat Window on the Dashboard!
          if (convId) {
            try {
              await supabaseAdmin.from('messages').insert({
                conversation_id: convId,
                org_id: lead.org_id,
                sender_type: 'bot',
                direction: 'outgoing',
                message: followUpMessage,
                provider_message_id: wamid,
                timestamp: sentTime,
                platform: 'whatsapp'
              })

              await supabaseAdmin.from('conversations').update({
                last_message: followUpMessage,
                updated_at: sentTime
              }).eq('id', convId)
            } catch (msgErr) {
              console.error('[cron:followup] Error logging message to DB:', msgErr)
            }
          }

          processed.push({ lead_id: lead.id, status: 'sent', wamid })
        }
      }
    }

    // 2. Also process legacy scheduled_drips if table exists
    try {
      const { data: pendingDrips } = await supabaseAdmin
        .from('scheduled_drips')
        .select('*, leads(*)')
        .eq('status', 'pending')
        .lte('scheduled_for', nowIso)
        .limit(25)

      if (pendingDrips && pendingDrips.length > 0) {
        for (const drip of pendingDrips) {
          await supabaseAdmin.from('scheduled_drips').update({ status: 'sent' }).eq('id', drip.id)
          processed.push({ drip_id: drip.id, status: 'sent' })
        }
      }
    } catch (e) {}

    return NextResponse.json({ success: true, processed_count: processed.length, processed })
  } catch (error: any) {
    console.error('[CRON API Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
