import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { phone, name, template_name, template_lang, variables, message_text, userId } = body

    if (!phone || !template_name || !template_lang) {
      return NextResponse.json({ error: 'Missing required fields: phone, template_name, template_lang' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (!cleanPhone) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    // 1. Fetch organization WhatsApp settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('organization_settings')
      .select('whatsapp_token, whatsapp_phone_id')
      .eq('org_id', orgId)
      .single()

    if (settingsError || !settings || !settings.whatsapp_token || !settings.whatsapp_phone_id) {
      return NextResponse.json({ error: 'WhatsApp credentials not configured for your organization.' }, { status: 400 })
    }

    const { whatsapp_token: token, whatsapp_phone_id: phoneId } = settings

    // 2. Format components for Meta Template message
    const components: any[] = []
    if (variables && Array.isArray(variables) && variables.length > 0) {
      components.push({
        type: 'body',
        parameters: variables.map(v => ({
          type: 'text',
          text: String(v)
        }))
      })
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: template_name,
        language: {
          code: template_lang
        },
        ...(components.length > 0 ? { components } : {})
      }
    }

    // 3. Send template message via Meta Cloud API
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    )

    const metaData = await metaRes.json()
    if (metaData.error) {
      console.error('[initiate conversation] Meta API Error:', metaData.error)
      return NextResponse.json({ error: metaData.error.message || 'Meta API call failed' }, { status: 400 })
    }

    const resolvedMessageText = message_text || `Template: ${template_name}`

    // 4. Upsert conversation record
    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversations')
      .upsert({
        phone_number: cleanPhone,
        name: name || cleanPhone,
        last_message: resolvedMessageText,
        org_id: orgId,
        unread_count: 0,
        ai_mode: false,
        stage: 'new',
        updated_at: new Date().toISOString(),
        ...(userId ? { assigned_to: userId, assignment_status: 'assigned' } : {})
      }, { onConflict: 'phone_number,org_id' })
      .select()
      .single()

    if (convError) throw convError

    // 5. Upsert lead record
    const { error: leadError } = await supabaseAdmin
      .from('leads')
      .upsert({
        conversation_id: conv.id,
        org_id: orgId,
        phone_number: cleanPhone,
        name: name || cleanPhone
      }, { onConflict: 'conversation_id' })

    if (leadError) throw leadError

    // 6. Insert outgoing template message record
    const wamid = metaData?.messages?.[0]?.id

    const { error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conv.id,
        org_id: orgId,
        phone_number: cleanPhone,
        message: resolvedMessageText,
        direction: 'outgoing',
        timestamp: new Date().toISOString(),
        ...(wamid ? { provider_message_id: wamid } : {})
      })

    if (msgError) throw msgError

    // 7. Establish assignment configuration if user is selected
    if (userId) {
      await supabaseAdmin
        .from('conversation_assignments')
        .upsert({
          conversation_id: conv.id,
          org_id: orgId,
          assigned_to: userId,
          status: 'active'
        }, { onConflict: 'conversation_id' })

      await supabaseAdmin
        .from('assignment_logs')
        .insert({
          conversation_id: conv.id,
          org_id: orgId,
          user_id: userId,
          action: 'assigned',
          details: 'Initiated conversation via template'
        })
    }

    return NextResponse.json({ success: true, conversation: conv })
  } catch (err: any) {
    console.error('[initiate conversation] Exception:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
