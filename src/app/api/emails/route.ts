import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// 1. GET: Fetch all email tickets for the authenticated organization
export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: emails, error } = await supabaseAdmin
      .from('emails')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[API/Emails] Database fetch error:', error)
      throw error
    }

    return NextResponse.json(emails || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

// 2. POST: Webhook ingestion for new incoming emails
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgSlug = searchParams.get('org') || ''

    if (!orgSlug) {
      return NextResponse.json({ error: 'Missing organization identifier (?org=slug)' }, { status: 400 })
    }

    // Resolve organization ID by slug
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .eq('slug', orgSlug)
      .single()

    if (orgErr || !org) {
      return NextResponse.json({ error: 'Invalid organization slug' }, { status: 404 })
    }

    const body = await req.json()
    const { message_id, from_email, from_name, to_email, subject, body_text, ai_draft_reply } = body

    if (!message_id || !from_email || !subject || !body_text) {
      return NextResponse.json({ error: 'Missing required parameters: message_id, from_email, subject, or body_text' }, { status: 400 })
    }

    // Store the email metadata first (default pending approval, null draft)
    const { data: newEmail, error: insertErr } = await supabaseAdmin
      .from('emails')
      .insert({
        org_id: org.id,
        message_id,
        from_email,
        from_name: from_name || null,
        to_email: to_email || 'support@voxaiagents.com',
        subject,
        body_text,
        status: 'pending_approval'
      })
      .select()
      .single()

    if (insertErr) {
      // If we already ingested this email (message_id unique conflict), return 200 OK to n8n to avoid loops
      if (insertErr.code === '23505') {
        return NextResponse.json({ success: true, message: 'Email already exists', duplicate: true })
      }
      console.error('[API/Emails] Insert error:', insertErr)
      throw insertErr
    }

    // Generate AI draft reply using Gemini (zero dependencies API call)
    let aiDraft = ai_draft_reply || ''
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!aiDraft && geminiApiKey) {
      try {
        console.log(`[API/Emails] Triggering Gemini draft for email: ${message_id}`)
        
        const systemPrompt = `Draft a polite, professional, and helpful email reply to the customer's email.
Use the following context about our organization if helpful:
- Organization Name: ${org.name}

Customer Email Details:
- From: ${from_name || from_email}
- Subject: ${subject}
- Content:
${body_text}

Requirements:
- Keep the tone helpful, concise, and professional.
- Do not make up facts; if you don't know, ask them to wait for support review.
- Provide placeholders like [Your Name] only where necessary.
- Output ONLY the body of the reply email (do not include email headers, subject lines, greetings like "Subject:", or introductory explanations). Just the message itself.`

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }]
            })
          }
        )

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json()
          aiDraft = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
        } else {
          console.error('[API/Emails] Gemini API response error:', await geminiRes.text())
        }
      } catch (geminiErr) {
        console.error('[API/Emails] Gemini draft generation failed:', geminiErr)
      }
    }

    // Fallback if Gemini key is missing or failed
    if (!aiDraft.trim()) {
      aiDraft = `Dear ${from_name || 'Customer'},\n\nThank you for reaching out to ${org.name}. We have received your query regarding "${subject}" and are currently looking into it. A support representative will get back to you shortly.\n\nBest regards,\nSupport Team\n${org.name}`
    }

    // Update the record with the draft
    const { data: finalEmail, error: updateErr } = await supabaseAdmin
      .from('emails')
      .update({ ai_draft_reply: aiDraft, updated_at: new Date().toISOString() })
      .eq('id', newEmail.id)
      .select()
      .single()

    if (updateErr) throw updateErr

    return NextResponse.json(finalEmail)
  } catch (err: any) {
    console.error('[API/Emails/POST]', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
