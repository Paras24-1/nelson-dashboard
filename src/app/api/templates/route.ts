import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch tenant-specific credentials
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('organization_settings')
      .select('whatsapp_token, whatsapp_phone_id, whatsapp_waba_id')
      .eq('org_id', orgId)
      .single()

    console.log(`[templates API] Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
    console.log(`[templates API] Settings raw:`, JSON.stringify(settings))

    if (settingsError || !settings || !settings.whatsapp_token || !settings.whatsapp_phone_id) {
      console.warn(`[templates API] Missing settings for org: ${orgId}`, settingsError)
      return NextResponse.json({ error: 'WhatsApp credentials not configured. Go to Settings.' }, { status: 400 })
    }

    const token = settings.whatsapp_token
    const phoneId = settings.whatsapp_phone_id
    let wabaId = settings.whatsapp_waba_id || ''

    console.log(`[templates API] GET templates for orgId: ${orgId}`)
    console.log(`[templates API] whatsapp_token (preview): ${token ? token.substring(0, 15) : 'EMPTY'}...`)
    console.log(`[templates API] whatsapp_phone_id: ${phoneId}`)
    console.log(`[templates API] whatsapp_waba_id: ${wabaId ? wabaId : 'EMPTY'}`)

    if (!wabaId) {
      // 1. Fetch businesses associated with the token to find the WABAs
      const businessesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/businesses`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      const businessesData = await businessesRes.json()
      if (businessesData.error) {
        console.error('[templates] Meta businesses fetch error:', businessesData.error)
        return NextResponse.json({ error: businessesData.error.message, details: businessesData.error }, { status: 500 })
      }

      const businesses = businessesData.data || []
      if (businesses.length === 0) {
        return NextResponse.json({ error: 'No Business Portfolios found for this token. Make sure the token is associated with a Meta Business Manager.' }, { status: 400 })
      }

      const accounts: any[] = []

      // Fetch owned WhatsApp Business Accounts for all businesses
      for (const biz of businesses) {
        const wabaRes = await fetch(
          `https://graph.facebook.com/v19.0/${biz.id}/owned_whatsapp_business_accounts`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )
        let wabaData = await wabaRes.json()
        if (wabaData.error) {
          // Fallback to whatsapp_business_accounts edge
          const fallbackRes = await fetch(
            `https://graph.facebook.com/v19.0/${biz.id}/whatsapp_business_accounts`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          )
          wabaData = await fallbackRes.json()
        }

        if (wabaData.data) {
          accounts.push(...wabaData.data)
        }
      }

      if (accounts.length === 0) {
        return NextResponse.json({ error: 'No WhatsApp Business Accounts found for the associated Business Portfolios.' }, { status: 400 })
      }

      // Deduplicate accounts just in case
      const uniqueAccounts = Array.from(new Map(accounts.map((acc) => [acc.id, acc])).values())

      if (uniqueAccounts.length === 1) {
        wabaId = uniqueAccounts[0].id
      } else {
        // Find which WABA owns the phoneId
        for (const acc of uniqueAccounts) {
          const phoneListRes = await fetch(
            `https://graph.facebook.com/v19.0/${acc.id}/phone_numbers`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          )
          const phoneListData = await phoneListRes.json()
          if (phoneListData.data?.some((p: any) => p.id === phoneId)) {
            wabaId = acc.id
            break
          }
        }
      }

      if (!wabaId) {
        return NextResponse.json({ error: 'Could not find a WhatsApp Business Account matching the configured Phone Number ID.' }, { status: 400 })
      }
    }

    // 2. Fetch all message templates from Meta WABA (APPROVED, PENDING, REJECTED)
    const templatesRes = await fetch(
      `https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      }
    )

    const templatesData = await templatesRes.json()
    if (templatesData.error) {
      console.error('[templates API] Meta templates fetch error details:', JSON.stringify(templatesData.error, null, 2))
      return NextResponse.json({ error: templatesData.error.message, details: templatesData.error }, { status: 500 })
    }

    // 3. Format templates for the frontend editor
    const templates = (templatesData.data || []).map((t: any) => ({
      id:       t.id,
      name:     t.name,
      language: t.language,
      status:   t.status,
      category: t.category,
      body:     t.components?.find((c: any) => c.type === 'BODY')?.text || '',
      header:   t.components?.find((c: any) => c.type === 'HEADER')?.text || '',
      header_format: t.components?.find((c: any) => c.type === 'HEADER')?.format || null,
      footer:   t.components?.find((c: any) => c.type === 'FOOTER')?.text || '',
      variables: (t.components?.find((c: any) => c.type === 'BODY')?.text || '')
        .match(/{{[a-zA-Z0-9_]+}}/g) || []
    }))

    return NextResponse.json(templates)

  } catch (err) {
    console.error('[templates API error]:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('organization_settings')
      .select('whatsapp_token, whatsapp_phone_id, whatsapp_waba_id')
      .eq('org_id', orgId)
      .single()

    if (settingsError || !settings || !settings.whatsapp_token || !settings.whatsapp_phone_id) {
      return NextResponse.json({ error: 'WhatsApp credentials not configured. Go to Settings.' }, { status: 400 })
    }

    const token = settings.whatsapp_token
    const phoneId = settings.whatsapp_phone_id
    let wabaId = settings.whatsapp_waba_id || ''

    if (!wabaId) {
      const businessesRes = await fetch(`https://graph.facebook.com/v20.0/me/businesses`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const businessesData = await businessesRes.json()
      const businesses = businessesData.data || []
      const accounts: any[] = []

      for (const biz of businesses) {
        const wabaRes = await fetch(`https://graph.facebook.com/v20.0/${biz.id}/owned_whatsapp_business_accounts`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const wabaData = await wabaRes.json()
        if (wabaData.data) accounts.push(...wabaData.data)
      }

      const uniqueAccounts = Array.from(new Map(accounts.map((acc) => [acc.id, acc])).values())
      if (uniqueAccounts.length === 1) {
        wabaId = uniqueAccounts[0].id
      } else {
        for (const acc of uniqueAccounts) {
          const phoneListRes = await fetch(`https://graph.facebook.com/v20.0/${acc.id}/phone_numbers`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const phoneListData = await phoneListRes.json()
          if (phoneListData.data?.some((p: any) => p.id === phoneId)) {
            wabaId = acc.id
            break
          }
        }
      }
    }

    if (!wabaId) {
      return NextResponse.json({ error: 'Could not resolve WhatsApp Business Account ID' }, { status: 400 })
    }

    const body = await req.json()
    const {
      name,
      category = 'MARKETING',
      language = 'en_US',
      header_format = 'NONE',
      header_text,
      body_text,
      body_examples = [],
      footer_text,
      buttons = []
    } = body

    if (!name || !body_text) {
      return NextResponse.json({ error: 'Template name and body text are required' }, { status: 400 })
    }

    // Clean name for Meta rules (lowercase, alphanumeric + underscores only)
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')

    // Build Meta Components Array
    const components: any[] = []

    // 1. Header
    if (header_format && header_format !== 'NONE') {
      const headerComp: any = { type: 'HEADER', format: header_format }
      if (header_format === 'TEXT' && header_text) {
        headerComp.text = header_text
      }
      components.push(headerComp)
    }

    // 2. Body
    const bodyComp: any = { type: 'BODY', text: body_text }
    if (Array.isArray(body_examples) && body_examples.length > 0) {
      bodyComp.example = {
        body_text: [body_examples]
      }
    }
    components.push(bodyComp)

    // 3. Footer
    if (footer_text && footer_text.trim()) {
      components.push({ type: 'FOOTER', text: footer_text.trim() })
    }

    // 4. Buttons
    if (Array.isArray(buttons) && buttons.length > 0) {
      const formattedButtons = buttons.map((b: any) => {
        if (b.type === 'QUICK_REPLY' && b.text) {
          return { type: 'QUICK_REPLY', text: b.text.trim() }
        }
        if (b.type === 'URL' && b.text && b.url) {
          return { type: 'URL', text: b.text.trim(), url: b.url.trim() }
        }
        if (b.type === 'PHONE_NUMBER' && b.text && b.phone_number) {
          return { type: 'PHONE_NUMBER', text: b.text.trim(), phone_number: b.phone_number.trim() }
        }
        return null
      }).filter(Boolean)

      if (formattedButtons.length > 0) {
        components.push({ type: 'BUTTONS', buttons: formattedButtons })
      }
    }

    console.log(`[templates POST] Submitting template "${cleanName}" to WABA ${wabaId}:`, JSON.stringify(components, null, 2))

    // Submit to Meta Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: cleanName,
        category,
        language,
        components
      })
    })

    const metaData = await metaRes.json()
    if (metaData.error) {
      console.error('[templates POST error]:', metaData.error)
      return NextResponse.json({ 
        error: metaData.error.message || 'Meta rejected template creation',
        details: metaData.error 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      id: metaData.id,
      status: metaData.status || 'PENDING',
      name: cleanName
    })

  } catch (err: any) {
    console.error('[templates POST exception]:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
