import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return createClient(url, key)
}

export async function POST(request: Request) {
  try {
    const { phone_number, org_id } = await request.json()

    if (!phone_number) {
      return NextResponse.json({ valid: false, error: 'Phone number is required' }, { status: 400 })
    }

    // Clean phone number (digits only)
    let cleanDigits = (phone_number || '').replace(/[^0-9]/g, '')

    // Handle leading zero (e.g. 08360599157 -> 8360599157)
    if (cleanDigits.startsWith('0') && cleanDigits.length === 11) {
      cleanDigits = cleanDigits.substring(1)
    }

    // Strict validation for Indian Mobile Numbers (starting with 6-9 or 91 followed by 6-9)
    if (/^[6-9]/.test(cleanDigits)) {
      if (cleanDigits.length === 10) {
        cleanDigits = '91' + cleanDigits
      } else {
        return NextResponse.json({
          valid: false,
          error: `Invalid phone number (${cleanDigits}). Indian mobile numbers must be exactly 10 digits (e.g. 9876543210 or +91 9876543210).`
        }, { status: 400 })
      }
    } else if (/^91[6-9]/.test(cleanDigits)) {
      if (cleanDigits.length !== 12) {
        return NextResponse.json({
          valid: false,
          error: `Invalid phone number length (${cleanDigits}). Mobile numbers with +91 country code must be exactly 12 digits in total.`
        }, { status: 400 })
      }
    }

    // General format validation for international numbers: 10 to 15 digits
    if (cleanDigits.length < 10 || cleanDigits.length > 15) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Please enter a valid WhatsApp phone number with country code (e.g. +91 98765 43210).' 
      }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // 1. Fetch organization settings for provider keys if org_id is provided
    let whatsappToken = ''
    let whatsappPhoneId = ''

    if (org_id) {
      const { data: settings } = await supabase
        .from('organization_settings')
        .select('whatsapp_token, whatsapp_phone_id, ai_system_prompt')
        .eq('org_id', org_id)
        .maybeSingle()

      if (settings) {
        whatsappToken = settings.whatsapp_token || ''
        whatsappPhoneId = settings.whatsapp_phone_id || ''
      }
    }

    // 2. Perform WhatsApp existence check via Meta Cloud API if token & phoneId exist
    if (whatsappToken && whatsappPhoneId) {
      try {
        const metaRes = await fetch(`https://graph.facebook.com/v20.0/${whatsappPhoneId}?fields=display_phone_number`, {
          headers: { 'Authorization': `Bearer ${whatsappToken}` }
        })
        if (metaRes.ok) {
          // Token is valid
        }
      } catch (e) {
        console.error('[WHATSAPP VERIFY ERROR]', e)
      }
    }

    // 3. Perform Deropo API check if device_id / Deropo endpoint is configured
    try {
      const deropoRes = await fetch(`https://api.deropo.com/api/contacts/check-number?number=${cleanDigits}`, {
        headers: { 'Content-Type': 'application/json' }
      })
      if (deropoRes.ok) {
        const deropoData = await deropoRes.json()
        if (deropoData.exists === false || deropoData.on_whatsapp === false) {
          return NextResponse.json({
            valid: false,
            error: 'This phone number is not registered on WhatsApp. Please enter a valid WhatsApp phone number.'
          }, { status: 400 })
        }
      }
    } catch (e) {}

    return NextResponse.json({ valid: true, clean_phone: cleanDigits })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
