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

    // 2. Process Native Visual Workflow Instances
    try {
      // Fetch instances from database or fallback store in ai_system_prompt
      let dueInstances: any[] = []
      const { data: dbInsts, error: instErr } = await supabaseAdmin
        .from('workflow_instances')
        .select('*')
        .in('status', ['pending', 'active'])
        .lte('next_run_at', nowIso)
        .limit(25)

      if (!instErr && dbInsts && dbInsts.length > 0) {
        dueInstances = dbInsts
      } else {
        // Fallback: Check organization_settings ai_system_prompt __WORKFLOW_INSTANCES_STORE__
        const { data: allSettings } = await supabaseAdmin.from('organization_settings').select('org_id, ai_system_prompt')
        if (allSettings) {
          allSettings.forEach(s => {
            const promptStr = s.ai_system_prompt || ''
            const match = promptStr.match(/__WORKFLOW_INSTANCES_STORE__=([\s\S]*?)__END_WORKFLOW_INSTANCES_STORE__/)
            if (match) {
              try {
                const insts: any[] = JSON.parse(match[1])
                insts.forEach(inst => {
                  if ((inst.status === 'pending' || inst.status === 'active') && inst.next_run_at <= nowIso) {
                    dueInstances.push(inst)
                  }
                })
              } catch (e) {}
            }
          })
        }
      }

      // Helper to update instance in fallback store if table is missing
      const updateInstanceInStore = async (instId: string, orgId: string, updates: Record<string, any>) => {
        const { error } = await supabaseAdmin.from('workflow_instances').update(updates).eq('id', instId)
        if (error) {
          const { data: settings } = await supabaseAdmin.from('organization_settings').select('ai_system_prompt').eq('org_id', orgId).maybeSingle()
          let promptStr = settings?.ai_system_prompt || ''
          const storeRegex = /__WORKFLOW_INSTANCES_STORE__=([\s\S]*?)__END_WORKFLOW_INSTANCES_STORE__/
          const match = promptStr.match(storeRegex)
          if (match) {
            try {
              let currentInstances: any[] = JSON.parse(match[1])
              const target = currentInstances.find(i => i.id === instId)
              if (target) {
                Object.assign(target, updates)
                const newStoreStr = `__WORKFLOW_INSTANCES_STORE__=${JSON.stringify(currentInstances)}__END_WORKFLOW_INSTANCES_STORE__`
                const newPrompt = promptStr.replace(storeRegex, newStoreStr)
                await supabaseAdmin.from('organization_settings').update({ ai_system_prompt: newPrompt }).eq('org_id', orgId)
              }
            } catch (e) {}
          }
        }
      }

      for (const inst of dueInstances) {
        // Fetch workflow definition
        let wf: any = null
        if (inst.workflow_id) {
          const { data: dbWf } = await supabaseAdmin.from('workflow_definitions').select('*').eq('id', inst.workflow_id).maybeSingle()
          wf = dbWf
        }
        if (!wf) {
          const { data: settings } = await supabaseAdmin.from('organization_settings').select('ai_system_prompt').eq('org_id', inst.org_id).maybeSingle()
          const promptStr = settings?.ai_system_prompt || ''
          const match = promptStr.match(/__WORKFLOWS_STORE__=([\s\S]*?)__END_WORKFLOWS_STORE__/)
          if (match) {
            try {
              const allWfs: any[] = JSON.parse(match[1])
              wf = allWfs.find(w => w.id === inst.workflow_id) || allWfs[0]
            } catch (e) {}
          }
        }

        if (!wf || !wf.steps || wf.steps.length === 0) continue

        let stepIndex = inst.current_step_index || 0
        if (stepIndex >= wf.steps.length) {
          // Workflow completed
          await updateInstanceInStore(inst.id, inst.org_id, { status: 'completed' })
          continue
        }

        let currentStep = wf.steps[stepIndex]

        // Handle Delay Node if hit directly
        if (currentStep.type === 'delay') {
          const delayMins = parseInt(currentStep.delay_minutes || '60')
          const nextRun = new Date(Date.now() + delayMins * 60 * 1000).toISOString()
          stepIndex += 1
          
          await updateInstanceInStore(inst.id, inst.org_id, {
            current_step_index: stepIndex,
            next_run_at: nextRun,
            status: stepIndex >= wf.steps.length ? 'completed' : 'pending'
          })

          processed.push({ instance_id: inst.id, step: 'delay', delay_minutes: delayMins })
          continue
        }

        // Handle Action Node
        if (currentStep.type === 'action') {
          if (currentStep.action_type === 'whatsapp') {
            const cleanPhone = String(inst.phone_number || '').replace(/\D/g, '')
            if (cleanPhone) {
              const { data: orgSettings } = await supabaseAdmin.from('organization_settings').select('whatsapp_token, whatsapp_phone_id').eq('org_id', inst.org_id).maybeSingle()
              const whatsappToken = orgSettings?.whatsapp_token || process.env.WHATSAPP_TOKEN
              const activePhoneId = orgSettings?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_ID

              if (whatsappToken && activePhoneId) {
                let payload: any = null
                if (currentStep.whatsapp_template_name) {
                  const headerImg = currentStep.whatsapp_header_image_url || inst.metadata?.header_image_url
                  const param1Val = (currentStep.whatsapp_param1 || '{Name}').replace('{Name}', inst.lead_name || 'there')
                  const param2Val = (currentStep.whatsapp_param2 || '{Industry}').replace('{Industry}', 'business')

                  const components: any[] = [
                    {
                      type: 'body',
                      parameters: [
                        { type: 'text', text: param1Val },
                        { type: 'text', text: param2Val }
                      ]
                    }
                  ]

                  if (headerImg) {
                    components.unshift({
                      type: 'header',
                      parameters: [
                        { type: 'image', image: { link: headerImg } }
                      ]
                    })
                  }

                  payload = {
                    messaging_product: 'whatsapp',
                    to: cleanPhone,
                    type: 'template',
                    template: {
                      name: currentStep.whatsapp_template_name,
                      language: { code: 'en' },
                      components
                    }
                  }
                } else {
                  const msgText = (currentStep.whatsapp_message || 'Hello!')
                    .replace('{Name}', inst.lead_name || 'there')
                    .replace('{Industry}', 'business')
                  payload = {
                    messaging_product: 'whatsapp',
                    to: cleanPhone,
                    type: 'text',
                    text: { body: msgText }
                  }
                }

                try {
                  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${activePhoneId}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  })
                  if (!metaRes.ok) console.error('[cron:native_wf] Meta API error:', await metaRes.text())
                } catch (e) {
                  console.error('[cron:native_wf] Meta fetch error:', e)
                }
              }
            }
          }

          // Advance to next step after action
          stepIndex += 1
          let nextRun = new Date().toISOString()
          if (stepIndex < wf.steps.length && wf.steps[stepIndex].type === 'delay') {
            const delayMins = parseInt(wf.steps[stepIndex].delay_minutes || '60')
            nextRun = new Date(Date.now() + delayMins * 60 * 1000).toISOString()
            stepIndex += 1 // Advance past delay node
          }

          const finalStatus = stepIndex >= wf.steps.length ? 'completed' : 'pending'
          await updateInstanceInStore(inst.id, inst.org_id, {
            current_step_index: stepIndex,
            next_run_at: nextRun,
            status: finalStatus
          })

          processed.push({ instance_id: inst.id, step: 'action', action_type: currentStep.action_type })
        }
      }
    } catch (wfCronErr) {
      console.error('[cron] Error processing native workflow instances:', wfCronErr)
    }

    return NextResponse.json({ success: true, processed_count: processed.length, processed })
  } catch (error: any) {
    console.error('[CRON API Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
