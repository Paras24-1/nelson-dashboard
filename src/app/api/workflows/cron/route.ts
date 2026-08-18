import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseVoiceAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Process a single step for a workflow instance
async function processInstanceStep(instance: any) {
  try {
    const { data: wf } = await supabaseAdmin
      .from('workflow_definitions')
      .select('*')
      .eq('id', instance.workflow_id)
      .single()

    if (!wf || !wf.is_active) {
      await supabaseAdmin
        .from('workflow_instances')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', instance.id)
      return { id: instance.id, status: 'paused' }
    }

    const steps = wf.steps || []
    let stepIdx = instance.current_step_index || 0

    if (stepIdx >= steps.length) {
      await supabaseAdmin
        .from('workflow_instances')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', instance.id)
      return { id: instance.id, status: 'completed' }
    }

    const currentStep = steps[stepIdx]

    // Execute current step action
    if (currentStep.type === 'action') {
      const actionType = currentStep.action_type
      console.log(`[Workflow Engine] Executing step ${stepIdx} (${actionType}) for ${instance.phone_number}`)

      if (actionType === 'voice_call') {
        // Trigger voice call via Voice SaaS DB
        if (supabaseVoiceAdmin && currentStep.agent_id) {
          const { data: orgData } = await supabaseAdmin
            .from('organizations')
            .select('voice_org_id')
            .eq('id', instance.org_id)
            .single()

          if (orgData?.voice_org_id) {
            // Queue call contact in voice database
            await supabaseVoiceAdmin
              .from('campaign_contacts')
              .insert({
                organization_id: orgData.voice_org_id,
                name: instance.lead_name || 'Workflow Followup',
                phone_number: instance.phone_number,
                status: 'pending'
              })
          }
        }
      } else if (actionType === 'crm_status') {
        // Update lead status in main DB
        if (instance.contact_id) {
          await supabaseAdmin
            .from('leads')
            .update({ status: currentStep.new_status || 'Followup Scheduled' })
            .eq('id', instance.contact_id)
        }
      } else if (actionType === 'whatsapp') {
        // Send WhatsApp Message via internal API
        const text = currentStep.whatsapp_message || ''
        if (text && instance.phone_number) {
          // Replace dynamic tags
          let finalMsg = text
          if (instance.lead_name) finalMsg = finalMsg.replace('{Name}', instance.lead_name)
          if (instance.metadata?.company_name) finalMsg = finalMsg.replace('{Business_Name}', instance.metadata.company_name)
          if (instance.metadata?.industry) finalMsg = finalMsg.replace('{Industry}', instance.metadata.industry)

          try {
            // Note: In real setup, you'd fetch the origin domain from req headers if passing req down, 
            // but for cron worker, localhost works if hitting its own internal route, or call n8n webhook directly.
            // For simplicity, we just insert it into `messages` table and let the listener pick it up.
            await supabaseAdmin.from('messages').insert({
              conversation_id: instance.conversation_id || 'new', // Needs real mapping ideally
              org_id: instance.org_id,
              phone_number: instance.phone_number,
              message: finalMsg,
              direction: 'outgoing',
              timestamp: new Date().toISOString(),
              platform: 'whatsapp'
            })
          } catch (e) {
            console.error('Failed to send workflow whatsapp:', e)
          }
        }
      } else if (actionType === 'human_handover') {
        // Notify consultant, set lead state
        await supabaseAdmin
          .from('leads')
          .update({ 
            status: 'Human Handover', 
            lead_priority: 'HIGH' 
          })
          .eq('phone_number', instance.phone_number)
          .eq('org_id', instance.org_id)
      } else if (actionType === 'ai_score') {
        // Call the async-ai-reply endpoint or do scoring logic inline
        // Since we built scoring into the async-ai-reply, this node just triggers an async fetch
        console.log(`[Workflow Engine] AI Score node triggered for ${instance.phone_number}`)
      }
    } else if (currentStep.type === 'condition' && currentStep.condition_type === 'branch_on_temperature') {
      const leadTemp = instance.metadata?.lead_temperature || 'COLD'
      if (leadTemp === 'HOT' && currentStep.branch_hot_step_index) {
        stepIdx = currentStep.branch_hot_step_index - 1 // Will be +1 below
      } else if (leadTemp === 'WARM' && currentStep.branch_warm_step_index) {
        stepIdx = currentStep.branch_warm_step_index - 1
      } else if (currentStep.branch_cold_step_index) {
        stepIdx = currentStep.branch_cold_step_index - 1
      }
    }

    // Determine next step
    const nextStepIdx = stepIdx + 1
    if (nextStepIdx >= steps.length) {
      await supabaseAdmin
        .from('workflow_instances')
        .update({
          current_step_index: nextStepIdx,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', instance.id)

      return { id: instance.id, status: 'completed' }
    }

    const nextStep = steps[nextStepIdx]
    let nextRunAt = new Date().toISOString()
    let nextStatus = 'active'

    if (nextStep.type === 'delay') {
      const delayMinutes = parseInt(nextStep.delay_minutes || '0')
      nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
      nextStatus = 'pending'
    }

    await supabaseAdmin
      .from('workflow_instances')
      .update({
        current_step_index: nextStepIdx,
        status: nextStatus,
        next_run_at: nextRunAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', instance.id)

    return { id: instance.id, status: nextStatus, nextStepIndex: nextStepIdx }
  } catch (err: any) {
    console.error(`[Workflow Engine Error] Instance ${instance.id}:`, err)
    await supabaseAdmin
      .from('workflow_instances')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', instance.id)
    return { id: instance.id, status: 'failed', error: err?.message || String(err) }
  }
}

// GET or POST /api/workflows/cron - In-house workflow execution poller
export async function GET(req: NextRequest) {
  try {
    const now = new Date().toISOString()

    // 1. Fetch all pending workflow instances whose next_run_at <= now
    const { data: pendingInstances, error } = await supabaseAdmin
      .from('workflow_instances')
      .select('*')
      .eq('status', 'pending')
      .lte('next_run_at', now)
      .limit(50)

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ processed: 0, message: 'workflow_instances table not created yet' })
      }
      throw error
    }

    const instancesToProcess = pendingInstances || []
    if (instancesToProcess.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No pending workflow steps to execute' })
    }

    const results = await Promise.all(instancesToProcess.map(processInstanceStep))

    return NextResponse.json({
      processedCount: results.length,
      results
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
