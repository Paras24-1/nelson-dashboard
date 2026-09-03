import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const formattedData = (data || []).map((c: any) => {
      let pbName = c.phonebook_name || null
      let body = c.template_body || ''
      if (body.includes('__PHONEBOOK__=')) {
        const match = body.match(/__PHONEBOOK__=(.*?)__END_PHONEBOOK__\n?/)
        if (match) {
          pbName = match[1]
          body = body.replace(match[0], '')
        }
      }
      return {
        ...c,
        phonebook_name: pbName,
        template_body: body
      }
    })

    return NextResponse.json(formattedData)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, template_name, template_body, template_language, contacts, scheduled_at, header_image_url, phonebook_name } = body

    console.log(`[campaigns API] POST parameters:`, JSON.stringify({ name, template_name, template_language, phonebook_name, contacts_count: contacts?.length }))

    // Deduplicate contacts by phone number to prevent constraint errors
    const uniqueContactsMap = new Map<string, any>()
    contacts.forEach((c: any) => {
      let cleanPhone = String(c.phone || '').replace(/\D/g, '')
      if (cleanPhone.length === 10 && /^[6789]/.test(cleanPhone)) {
        cleanPhone = '91' + cleanPhone
      }
      if (cleanPhone.length >= 10) {
        uniqueContactsMap.set(cleanPhone, { ...c, phone: cleanPhone })
      }
    })
    const uniqueContacts = Array.from(uniqueContactsMap.values())

    if (uniqueContacts.length === 0) {
      return NextResponse.json({ error: 'No valid contacts provided' }, { status: 400 })
    }

    const storedTemplateBody = phonebook_name
      ? `__PHONEBOOK__=${phonebook_name}__END_PHONEBOOK__\n${template_body || ''}`
      : (template_body || '')

    const { data: campaign, error: campError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        org_id: orgId,
        name,
        template_name,
        template_body: storedTemplateBody,
        template_language: template_language || 'en',
        total: uniqueContacts.length,
        status: scheduled_at ? 'draft' : 'sending',
        scheduled_at: scheduled_at || null,
        started_at: scheduled_at ? null : new Date().toISOString(),
      })
      .select()
      .single()

    if (campError) throw campError

    const contactRows = uniqueContacts.map((c: any) => ({
      campaign_id: campaign.id,
      org_id: orgId,
      phone: c.phone,
      name: c.name || '',
      variables: c.variables || {},
      status: 'pending',
    }))

    const { error: contactError } = await supabaseAdmin
      .from('campaign_contacts')
      .insert(contactRows)

    if (contactError) throw contactError

    // Get org's n8n bulk webhook
    if (!scheduled_at) {
      const { data: settings } = await supabaseAdmin
        .from('organization_settings')
        .select('n8n_webhook_url')
        .eq('org_id', orgId)
        .single()

      const DEFAULT_BULK_URL = 'https://resplendent-rejoicing-production-4b92.up.railway.app/webhook/bulk-sendMulti'
      const n8nUrl = settings?.n8n_webhook_url || process.env.N8N_BULK_WEBHOOK_URL || DEFAULT_BULK_URL
      if (n8nUrl) {
        await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            campaign_id: campaign.id, 
            template_name, 
            template_language: campaign.template_language || template_language || 'en',
            contacts: uniqueContacts,
            header_image_url: header_image_url || ''
          }),
        }).catch(console.error)
      }

      // Auto-enroll campaign contacts into active bulk_message_sent workflows natively
      try {
        const triggerUrl = new URL('/api/workflows/trigger', req.url).toString()
        await fetch(triggerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: orgId,
            event_type: 'bulk_message_sent',
            contacts: uniqueContacts,
            metadata: { campaign_id: campaign.id, template_name }
          })
        }).catch(console.error)
      } catch (wfErr) {
        console.error('[campaigns] Native workflow trigger error:', wfErr)
      }
    }

    return NextResponse.json({ success: true, campaign_id: campaign.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}