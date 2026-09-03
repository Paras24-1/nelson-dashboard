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
    const orgSlug = searchParams.get('org') || searchParams.get('org_id') || ''
    let orgId: string | null = null
    const body = await req.json()

    // Priority 1: Resolve automatically by Meta phone_number_id if present in organization_settings
    if (body.object === 'whatsapp_business_account') {
      const phoneId = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
      if (phoneId) {
        const { data: settings } = await supabaseAdmin
          .from('organization_settings')
          .select('org_id')
          .eq('whatsapp_phone_id', phoneId)
          .maybeSingle()
        if (settings?.org_id) {
          orgId = settings.org_id
        }
      }
    }

    // Priority 2: Fallback to query param slug/id if phone_number_id didn't match
    if (!orgId && orgSlug) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(orgSlug)
      const { data: org } = await (isUuid
        ? supabaseAdmin.from('organizations').select('id').eq('id', orgSlug).maybeSingle()
        : supabaseAdmin.from('organizations').select('id').eq('slug', orgSlug).maybeSingle())
      orgId = org?.id || null
    }

    if (!orgId) {
      console.warn('[webhook] Could not resolve orgId from request URL or payload phone_number_id')
      return NextResponse.json({ error: 'Invalid org' }, { status: 400 })
    }

    const { data: orgSettings } = await supabaseAdmin
      .from('organization_settings')
      .select('whatsapp_token, n8n_inbound_webhook_url')
      .eq('org_id', orgId)
      .maybeSingle()
    
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
        parsedProviderPhoneId = change.metadata?.phone_number_id || null
        parsedName = change.contacts?.[0]?.profile?.name || msg.from
        
        if (msg.referral) {
          const headline = msg.referral.headline || msg.referral.body || msg.referral.source_url
          const referralText = headline ? `[Ad Referral: ${headline}]` : '[Ad Lead]'
          if (msg.type === 'text' && msg.text?.body) {
            parsedMessage = `${msg.text.body}\n${referralText}`
          } else {
            parsedMessage = referralText
          }
        } else if (msg.type === 'text') {
          parsedMessage = msg.text?.body
        } else if (msg.type === 'interactive') {
          const interactive = msg.interactive
          if (interactive?.type === 'button_reply') {
            parsedMessage = interactive.button_reply?.title || interactive.button_reply?.id || '[Button Response]'
          } else if (interactive?.type === 'list_reply') {
            parsedMessage = interactive.list_reply?.title || interactive.list_reply?.description || '[List Selection]'
          } else {
            parsedMessage = '[Interactive Response]'
          }
        } else if (msg.type === 'button') {
          parsedMessage = msg.button?.text || msg.button?.payload || '[Button Response]'
        } else if (msg.type === 'location') {
          const loc = msg.location
          const locDetails = loc?.name || loc?.address || (loc?.latitude && loc?.longitude ? `${loc.latitude}, ${loc.longitude}` : '')
          parsedMessage = locDetails ? `[Location: ${locDetails}]` : '[Location Shared]'
        } else if (msg.type === 'contacts') {
          const cName = msg.contacts?.[0]?.name?.formatted_name
          const cPhone = msg.contacts?.[0]?.phones?.[0]?.phone
          parsedMessage = `[Contact: ${cName || cPhone || 'Shared Contact'}]`
        } else if (msg.type === 'reaction') {
          parsedMessage = `[Reaction: ${msg.reaction?.emoji || '👍'}]`
        } else if (msg.type === 'sticker') {
          parsedMediaType = 'sticker'
          parsedMessage = '[Sticker]'
        } else if (msg.type === 'image' || msg.type === 'document' || msg.type === 'audio' || msg.type === 'video') {
          parsedMediaType = msg.type
          parsedMessage = msg.type === 'document' && msg.document?.filename ? `[Document: ${msg.document.filename}]` : `[Received ${msg.type}]`

          const tokensToTry = Array.from(new Set([
            orgSettings?.whatsapp_token,
            process.env.WHATSAPP_TOKEN,
            process.env.WHATSAPP_API_TOKEN,
            process.env.META_ACCESS_TOKEN
          ].filter(Boolean))) as string[]

          const mediaId = msg[msg.type]?.id
          if (mediaId && tokensToTry.length > 0) {
            for (const token of tokensToTry) {
              try {
                // 1. Get Media URL
                const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                })
                const metaData = await metaRes.json()
                
                if (metaData.url) {
                  // 2. Download Media Buffer
                  const mediaRes = await fetch(metaData.url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                  if (mediaRes.ok) {
                    const buffer = await mediaRes.arrayBuffer()
                    
                    // 3. Upload to Supabase Storage
                    const ext = msg.type === 'audio' ? 'ogg' : msg.type === 'image' ? 'jpg' : msg.type === 'video' ? 'mp4' : 'pdf'
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
                      break
                    } else {
                      console.error('[webhook] Supabase Storage Error:', uploadError)
                    }
                  }
                }
              } catch (mediaErr) {
                console.error('[webhook] Media Download Attempt Error:', mediaErr)
              }
            }
          }
        } else {
          parsedMessage = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || `[${msg.type || 'Message'}]`
        }
      } else if (change?.statuses && change.statuses.length > 0) {
        // Message delivery status update (sent, delivered, read)
        const statusObj = change.statuses[0]
        const messageId = statusObj.id
        const newStatus = statusObj.status // 'sent', 'delivered', 'read', 'failed'

        if (messageId && newStatus) {
          // Never downgrade a status that is already delivered/read to failed
          // This happens when n8n sends a duplicate message that Meta rejects
          if (newStatus === 'failed') {
            const { data: existingMsg } = await supabaseAdmin
              .from('messages')
              .select('status')
              .eq('provider_message_id', messageId)
              .eq('org_id', orgId)
              .maybeSingle()
            
            if (existingMsg && (existingMsg.status === 'delivered' || existingMsg.status === 'read')) {
              console.log(`[webhook] Ignoring 'failed' status for message ${messageId} — already ${existingMsg.status}`)
              return NextResponse.json({ success: true, status: 'ignored_downgrade' })
            }

            if (statusObj.errors) {
              console.error('[webhook] Meta Message Failed:', JSON.stringify(statusObj.errors))
            }
          }

          const updatePayload: any = { status: newStatus }

          await supabaseAdmin
            .from('messages')
            .update(updatePayload)
            .eq('provider_message_id', messageId)
            .eq('org_id', orgId)

          // Update bulk campaign contact by wamid and recalculate campaign stats
          const { data: updatedContact } = await supabaseAdmin
            .from('campaign_contacts')
            .update({
              status: newStatus,
              ...(newStatus === 'failed' && statusObj.errors ? { error: JSON.stringify(statusObj.errors) } : {})
            })
            .eq('wamid', messageId)
            .select('campaign_id')

          if (updatedContact && updatedContact.length > 0) {
            const campaignId = updatedContact[0].campaign_id
            if (campaignId) {
              const { data: counts } = await supabaseAdmin
                .from('campaign_contacts')
                .select('status')
                .eq('campaign_id', campaignId)

              if (counts) {
                const sent      = counts.filter((c) => c.status === 'sent').length
                const delivered = counts.filter((c) => c.status === 'delivered' || c.status === 'read').length
                const failed    = counts.filter((c) => c.status === 'failed').length
                const pending   = counts.filter((c) => c.status === 'pending').length

                await supabaseAdmin
                  .from('campaigns')
                  .update({
                    sent,
                    delivered,
                    failed,
                    status: pending === 0 ? 'completed' : 'sending',
                    completed_at: pending === 0 ? new Date().toISOString() : null,
                  })
                  .eq('id', campaignId)
              }
            }
          }
        }
        
        return NextResponse.json({ success: true, status: 'processed_status' })
      }
    }

    // Support unofficial Baileys / Evolution API payloads (body.data.message / body.data.from)
    if (!parsedPhone && body.data?.from) {
      parsedPhone = body.data.from.split('@')[0]
      parsedDirection = parsedDirection || 'incoming'
    }
    if (!parsedMessage && body.data?.message) {
      const rawMsg = body.data.message
      if (typeof rawMsg === 'string') {
        parsedMessage = rawMsg
      } else {
        parsedMessage = rawMsg.conversation || rawMsg.extendedTextMessage?.text || rawMsg.text || ''
      }
    }
    if (typeof parsedMessage === 'object' && parsedMessage !== null) {
      parsedMessage = (parsedMessage as any).conversation || (parsedMessage as any).extendedTextMessage?.text || (parsedMessage as any).text || ''
    }

    if (!parsedPhone || !parsedDirection) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const contactName = parsedName || parsedPhone
    const timestamp   = new Date()
    const msgText     = (parsedMessage && parsedMessage.trim()) ? parsedMessage : (parsedMediaType ? `[Received ${parsedMediaType}]` : '[Message]')
    
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
        .select('name, email, avatar, role')
        .eq('id', assignedTo)
        .eq('org_id', orgId)
        .maybeSingle()
      if (empData) {
        assignedEmployeeName = empData.name || empData.email
        assignedEmployeePhone = (empData as any).phone_number || (empData.avatar && empData.avatar.startsWith('phone:') ? empData.avatar.replace('phone:', '').trim() : null)
      }
    }

    // If unassigned or assigned employee has no phone, fallback to org team member with phone
    if (!assignedEmployeePhone && orgId) {
      const { data: orgUsers } = await supabaseAdmin
        .from('users')
        .select('name, email, avatar, role')
        .eq('org_id', orgId)
        .limit(20)
      if (orgUsers && orgUsers.length > 0) {
        const userWithPhone = orgUsers.find(u => (u as any).phone_number || (u.avatar && typeof u.avatar === 'string' && u.avatar.startsWith('phone:')))
        if (userWithPhone) {
          assignedEmployeePhone = (userWithPhone as any).phone_number || (userWithPhone.avatar && userWithPhone.avatar.startsWith('phone:') ? userWithPhone.avatar.replace('phone:', '').trim() : null)
          if (!assignedEmployeeName) {
            assignedEmployeeName = userWithPhone.name || userWithPhone.email
          }
        }
      }
    }

    // 7. [BOT BRAIN & HYBRID ROUTING] Check tenant AI Engine mode and settings
    let isHybridN8n = false
    if (direction === 'incoming') {
      try {
        const { data: orgSettings } = await supabaseAdmin
          .from('organization_settings')
          .select('n8n_inbound_webhook_url, ai_system_prompt, ai_knowledge_base_sheet_id, ai_knowledge_base_range, gemini_api_key, openai_api_key')
          .eq('org_id', orgId)
          .maybeSingle()

        console.log(`[webhook:routing] OrgID=${orgId} | hasPrompt=${!!orgSettings?.ai_system_prompt} | hasGeminiKey=${!!orgSettings?.gemini_api_key} | hasN8nUrl=${!!orgSettings?.n8n_inbound_webhook_url}`)

        let parsedPromptObj: any = {}
        if (orgSettings?.ai_system_prompt) {
          try {
            if (orgSettings.ai_system_prompt.startsWith('{')) {
              parsedPromptObj = JSON.parse(orgSettings.ai_system_prompt)
            }
          } catch (e) {
            parsedPromptObj = { system_prompt: orgSettings.ai_system_prompt }
          }
        }

        const engineMode = parsedPromptObj.engine_mode || (orgSettings?.n8n_inbound_webhook_url ? 'hybrid_n8n' : 'native')
        isHybridN8n = engineMode === 'hybrid_n8n' && !!orgSettings?.n8n_inbound_webhook_url
        console.log(`[webhook:routing] engineMode=${engineMode} | isHybridN8n=${isHybridN8n} | model=${parsedPromptObj.ai_model_name || '(not set)'}`)

        if (isHybridN8n && orgSettings?.n8n_inbound_webhook_url) {
          console.log(`[webhook] Forwarding Enriched Bot Brain Payload to tenant n8n: ${orgSettings.n8n_inbound_webhook_url}`)
          
          const kbMarkdown = parsedPromptObj.cached_kb?.markdown || ''
          const kbJson = parsedPromptObj.cached_kb?.json || []
          const rawSystemPrompt = parsedPromptObj.system_prompt || 'You are a helpful AI assistant.'
          const geminiApiKey = orgSettings.gemini_api_key || process.env.GEMINI_API_KEY || ''
          const openaiApiKey = orgSettings.openai_api_key || process.env.OPENAI_API_KEY || ''

          // Replace prompt template variables so n8n receives the fully rendered system prompt!
          const processedSystemPrompt = rawSystemPrompt
            .replace(/\{\{lead_name\}\}/g, contactName || 'Customer')
            .replace(/\{\{phone_number\}\}/g, phone_number || '')
            .replace(/\{\{assigned_employee\}\}/g, assignedEmployeeName || 'Unassigned')
            .replace(/\{\{assigned_employee_name\}\}/g, assignedEmployeeName || 'Unassigned')
            .replace(/\{\{assigned_employee_phone\}\}/g, assignedEmployeePhone || '')
            .replace(/\{\{stage\}\}/g, 'COLD')
            .replace(/\{\{knowledge_base\}\}/g, kbMarkdown || '')

          // Enriched Hybrid Payload
          const enrichedPayload = {
            ...body,
            org_id: orgId,
            conversation_id: conversation?.id,
            gemini_api_key: geminiApiKey,
            openai_api_key: openaiApiKey,
            lead: {
              phone_number,
              name: contactName,
              assigned_to: assignedTo,
              assigned_employee_name: assignedEmployeeName,
              assigned_employee_phone: assignedEmployeePhone
            },
            bot_brain: {
              engine_mode: 'hybrid_n8n',
              system_prompt: processedSystemPrompt,
              raw_system_prompt: rawSystemPrompt,
              assigned_employee_name: assignedEmployeeName,
              assigned_employee_phone: assignedEmployeePhone,
              gemini_api_key: geminiApiKey,
              openai_api_key: openaiApiKey,
              knowledge_base_markdown: kbMarkdown,
              knowledge_base_json: kbJson,
              google_sheet_id: orgSettings.ai_knowledge_base_sheet_id || '',
              google_sheet_range: orgSettings.ai_knowledge_base_range || 'Sheet1'
            }
          }

          // Fire and forget to n8n
          fetch(orgSettings.n8n_inbound_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enrichedPayload)
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
        const cleanPhone = String(phone_number).replace(/\D/g, '')
        await supabaseAdmin
          .from('scheduled_drips')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('phone_number', phone_number)
          .eq('status', 'pending')

        await supabaseAdmin
          .from('workflow_instances')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('phone_number', cleanPhone)
          .in('status', ['pending', 'active'])

        // Fallback: Pause in organization_settings metadata
        const { data: settings } = await supabaseAdmin
          .from('organization_settings')
          .select('metadata')
          .eq('org_id', orgId)
          .maybeSingle()

        if (settings?.metadata?.workflow_instances) {
          const insts: any[] = settings.metadata.workflow_instances
          let updated = false
          insts.forEach((inst: any) => {
            if (inst.phone_number === cleanPhone && (inst.status === 'pending' || inst.status === 'active')) {
              inst.status = 'paused'
              updated = true
            }
          })
          if (updated) {
            await supabaseAdmin
              .from('organization_settings')
              .update({ metadata: { ...settings.metadata, workflow_instances: insts } })
              .eq('org_id', orgId)
          }
        }
      } catch (stopDripErr) {
        console.warn('[webhook] Error pausing active workflows on reply:', stopDripErr)
      }

        // Trigger Async Native WhatsApp AI Chatbot
        // ONLY if n8n is NOT handling this org's inbound messages (to prevent duplicate replies)
        if (!isHybridN8n) {
          const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://voxaiagents.com'
          console.log(`[webhook:native-ai] Non-blocking dispatch to async-ai-reply | orgId=${orgId} | phone=${phone_number} | conv=${conversation.id}`)
          fetch(`${origin}/api/webhook/async-ai-reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              orgId, 
              phone_number, 
              message: msgText, 
              conversation_id: conversation.id 
            })
          }).then(res => {
            console.log(`[webhook:native-ai] async-ai-reply HTTP status: ${res.status}`)
          }).catch(err => {
            console.error('[webhook:native-ai] Failed to trigger async AI reply:', err)
          })
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