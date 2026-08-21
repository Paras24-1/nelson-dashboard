import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getNextEmployee(orgId: string): Promise<string | null> {
  const { data: employees } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', 'employee')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (!employees || employees.length === 0) return null

  // Get the last assigned conversation to find who was assigned last
  const { data: lastAssigned } = await supabaseAdmin
    .from('conversations')
    .select('assigned_to')
    .eq('org_id', orgId)
    .not('assigned_to', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastEmployeeId = lastAssigned?.assigned_to
  const lastIndex = employees.findIndex(e => e.id === lastEmployeeId)
  const nextIndex = (lastIndex + 1) % employees.length

  return employees[nextIndex].id
}

// Handle Meta Webhook Verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // You can set a strict NEXT_PUBLIC_META_VERIFY_TOKEN in env if needed, 
  // but usually it's fine to just reflect the challenge if mode is subscribe
  if (mode === 'subscribe' && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Invalid verification' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgSlug = searchParams.get('org') || ''

    // Get org by slug
    let orgId: string | null = null
    if (orgSlug) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', orgSlug)
        .single()
      orgId = org?.id || null
    }

    if (!orgId) {
      return NextResponse.json({ error: 'Invalid org' }, { status: 400 })
    }

    const { data: orgSettings } = await supabaseAdmin
      .from('organization_settings')
      .select('whatsapp_token, n8n_inbound_webhook_url')
      .eq('org_id', orgId)
      .maybeSingle()

    const body = await req.json()
    
    // Check if this is a native Meta WhatsApp Webhook Payload
    let parsedPhone = body.phone_number
    let parsedMessage = body.message
    let parsedDirection = body.direction
    let parsedName = body.name
    let parsedMediaUrl = body.media_url
    let parsedMediaType = body.media_type
    let parsedReceiverPhone = body.receiver_phone_number || null
    let parsedProviderPhoneId = null
    const parsedPlatform = body.platform || 'whatsapp'

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0]
      const change = entry?.changes?.[0]?.value
      if (change?.messages && change.messages.length > 0) {
        const msg = change.messages[0]
        parsedPhone = msg.from
        parsedDirection = 'incoming'
        parsedReceiverPhone = change.metadata?.display_phone_number || null
        parsedName = change.contacts?.[0]?.profile?.name || msg.from
        
        if (msg.type === 'text') {
          parsedMessage = msg.text?.body
        } else if (msg.type === 'image' || msg.type === 'document' || msg.type === 'audio') {
          parsedMediaType = msg.type
          parsedMessage = `[Received ${msg.type}]`

          if (orgSettings?.whatsapp_token) {
            const mediaId = msg[msg.type]?.id
            if (mediaId) {
              try {
                // 1. Get Media URL
                const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
                  headers: { 'Authorization': `Bearer ${orgSettings.whatsapp_token}` }
                })
                const metaData = await metaRes.json()
                
                if (metaData.url) {
                  // 2. Download Media Buffer
                  const mediaRes = await fetch(metaData.url, {
                    headers: { 'Authorization': `Bearer ${orgSettings.whatsapp_token}` }
                  })
                  const buffer = await mediaRes.arrayBuffer()
                  
                  // 3. Upload to Supabase
                  const ext = msg.type === 'audio' ? 'ogg' : msg.type === 'image' ? 'jpg' : 'pdf'
                  const fileName = `${orgId}/${Date.now()}-${mediaId}.${ext}`
                  
                  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                    .from('chat-media')
                    .upload(fileName, buffer, {
                      contentType: mediaRes.headers.get('content-type') || 'application/octet-stream',
                      upsert: true
                    })
                    
                  if (!uploadError && uploadData) {
                    const { data: publicUrlData } = supabaseAdmin.storage
                      .from('chat-media')
                      .getPublicUrl(fileName)
                    parsedMediaUrl = publicUrlData.publicUrl
                  } else {
                    console.error('[webhook] Supabase Storage Error:', uploadError)
                  }
                }
              } catch (mediaErr) {
                console.error('[webhook] Media Download Error:', mediaErr)
              }
            }
          }
        }
      } else if (change?.statuses && change.statuses.length > 0) {
        // Message delivery status update (sent, delivered, read)
        const statusObj = change.statuses[0]
        const messageId = statusObj.id
        const newStatus = statusObj.status // 'sent', 'delivered', 'read', 'failed'

        if (messageId && newStatus) {
          const updatePayload: any = { status: newStatus }
          
          // Debug logging without overwriting the actual user/AI message in the database!
          if (newStatus === 'failed' && statusObj.errors) {
            console.error('[webhook] Meta Message Failed:', JSON.stringify(statusObj.errors))
            // We NO LONGER inject META_ERROR into the message body so the chat UI stays clean.
          }

          await supabaseAdmin
            .from('messages')
            .update(updatePayload)
            .eq('provider_message_id', messageId)
            .eq('org_id', orgId)
        }
        
        return NextResponse.json({ success: true, status: 'processed_status' })
      }
    }

    if (!parsedPhone || !parsedDirection) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const contactName = parsedName || parsedPhone
    const timestamp   = new Date()
    const msgText     = parsedMessage || (parsedMediaType ? `[${parsedMediaType}]` : '')
    
    // Remap for the rest of the function
    const phone_number = parsedPhone
    const direction = parsedDirection
    const media_url = parsedMediaUrl
    const media_type = parsedMediaType
    const platform = parsedPlatform

    // 1. Check if conversation already exists
    const { data: existing } = await supabaseAdmin
      .from('conversations')
      .select('id, assigned_to, unread_count')
      .eq('phone_number', phone_number)
      .eq('org_id', orgId)
      .maybeSingle()

    // 2. Get next employee only for NEW conversations
    let assignedTo = existing?.assigned_to || null

    if (direction === 'incoming' && !assignedTo) {
      assignedTo = await getNextEmployee(orgId)
    }

    // 3. Upsert conversation with org_id
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .upsert(
        {
          phone_number,
          name: contactName,
          last_message: msgText,
          org_id: orgId,
          updated_at: new Date().toISOString(),
          platform: platform || 'whatsapp',
          ...(direction === 'incoming' 
            ? { unread_count: (existing?.unread_count || 0) + 1, last_incoming_message_at: new Date().toISOString() } 
            : {}),
          ...(assignedTo
            ? { assigned_to: assignedTo, assignment_status: 'assigned' }
            : {}),
          ...(parsedReceiverPhone
            ? { receiver_phone_number: parsedReceiverPhone }
            : {}),
          ...(parsedProviderPhoneId
            ? { provider_phone_id: parsedProviderPhoneId }
            : {})
        },
        { onConflict: 'phone_number,org_id' }
      )
      .select()
      .single()

    if (convError) throw convError

    // 4. Insert message with org_id
    const { data: msg, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        org_id: orgId,
        phone_number,
        message: msgText,
        direction,
        timestamp: timestamp.toISOString(),
        media_url:  media_url  || null,
        media_type: media_type || null,
        platform: platform || 'whatsapp',
      })
      .select()
      .single()

    if (msgError) throw msgError

    // 5. Upsert lead with org_id
    await supabaseAdmin
      .from('leads')
      .upsert(
        { conversation_id: conversation.id, org_id: orgId, phone_number, name: contactName },
        { onConflict: 'conversation_id' }
      )

    // 6. Log assignment if new conversation was assigned
    if (!existing && assignedTo) {
      await supabaseAdmin
        .from('conversation_assignments')
        .insert({
          conversation_id: conversation.id,
          org_id: orgId,
          assigned_to: assignedTo,
          assigned_by: null,
          status: 'active'
        })

      await supabaseAdmin
        .from('assignment_logs')
        .insert({
          conversation_id: conversation.id,
          org_id: orgId,
          user_id: assignedTo,
          action: 'auto_assigned',
          details: 'Round-robin auto assignment'
        })
    }

    // Fetch employee details if assigned
    let assignedEmployeeName = null
    let assignedEmployeePhone = null
    if (assignedTo) {
      const { data: empData } = await supabaseAdmin
        .from('users')
        .select('name, phone')
        .eq('id', assignedTo)
        .eq('org_id', orgId)
        .maybeSingle()
      assignedEmployeeName = empData?.name || null
      assignedEmployeePhone = empData?.phone || null
    }

    // 7. [FORWARDING] Check if the tenant has a custom n8n webhook configured
    // We do this BEFORE any slow AI fetch so n8n triggers instantly without delay
    if (direction === 'incoming') {
      try {
        const { data: orgSettings } = await supabaseAdmin
          .from('organization_settings')
          .select('n8n_inbound_webhook_url')
          .eq('org_id', orgId)
          .maybeSingle()

        if (orgSettings?.n8n_inbound_webhook_url) {
          console.log(`[webhook] Forwarding payload to tenant n8n: ${orgSettings.n8n_inbound_webhook_url}`)
          // Fire and forget, don't await so we don't block
          fetch(orgSettings.n8n_inbound_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }).catch(err => console.error(`[webhook] Failed to forward to n8n:`, err))
        }
      } catch (forwardErr) {
        console.error('[webhook] Error checking/forwarding to n8n:', forwardErr)
      }
    }

    // 8. [iWebMagics State Machine] STOP DRIP Reply Interceptor
    // If we receive an incoming message, pause any active workflows waiting for a delay
    if (direction === 'incoming') {
      try {
        const { error: stopDripError } = await supabaseAdmin
          .from('workflow_instances')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('phone_number', phone_number)
          .eq('org_id', orgId)
          .eq('status', 'pending') // Only stop if it's waiting in a delay node

        if (stopDripError) {
          console.error('[webhook] Failed to stop drip:', stopDripError)
        } else {
          console.log(`[webhook] STOP DRIP executed for ${phone_number}`)
        }
        
        // Trigger Async Native WhatsApp AI Chatbot & Scoring Engine
        // We await this AT THE END so Vercel Serverless does not suspend the process before it finishes
        // but AFTER forwarding to n8n so n8n isn't delayed by AI generation
        await fetch(`https://voxaiagents.com/api/webhook/async-ai-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            orgId, 
            phone_number, 
            message: msgText, 
            conversation_id: conversation.id 
          })
        }).catch(err => console.error('[webhook] Failed to trigger async AI reply:', err))

      } catch (e) {
        console.error('[webhook] State machine interceptor error:', e)
      }
    }

    return NextResponse.json({ 
      success: true, 
      conversation_id: conversation.id, 
      message_id: msg.id,
      assigned_to: assignedTo,
      assigned_employee_name: assignedEmployeeName,
      assigned_employee_phone: assignedEmployeePhone
    })

  } catch (err: any) {
    console.error('[webhook]', err)
    const errMsg = err?.message || String(err)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}