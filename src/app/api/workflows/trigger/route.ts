import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/workflows/trigger - Receives system event and starts matching workflows
export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { event_type, lead_id, phone_number, lead_name, metadata } = body

    if (!event_type || (!phone_number && !lead_id)) {
      return NextResponse.json(
        { error: 'Missing required parameters: event_type, phone_number or lead_id' },
        { status: 400 }
      )
    }

    // 1. Fetch active workflows for this org matching the trigger event
    const { data: activeWorkflows, error: wfError } = await supabaseAdmin
      .from('workflow_definitions')
      .select('*')
      .eq('org_id', orgId)
      .eq('trigger_event', event_type)
      .eq('is_active', true)

    if (wfError || !activeWorkflows || activeWorkflows.length === 0) {
      return NextResponse.json({ message: 'No active workflows for event', triggeredCount: 0 })
    }

    // 2. Spawn workflow instances for each matching active workflow
    const spawnedInstances = await Promise.all(
      activeWorkflows.map(async (wf) => {
        const steps = wf.steps || []
        if (steps.length === 0) return null

        const firstStep = steps[0]
        let nextRunAt = new Date().toISOString()

        // If the first step is a delay, compute next_run_at
        if (firstStep.type === 'delay') {
          const delayMinutes = parseInt(firstStep.delay_minutes || '0')
          nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
        }

        const { data: instance, error: instErr } = await supabaseAdmin
          .from('workflow_instances')
          .insert({
            workflow_id: wf.id,
            org_id: orgId,
            contact_id: lead_id || null,
            phone_number: phone_number || '',
            lead_name: lead_name || 'Lead',
            current_step_index: 0,
            status: firstStep.type === 'delay' ? 'pending' : 'active',
            next_run_at: nextRunAt,
            metadata: metadata || {}
          })
          .select()
          .single()

        if (instErr) {
          console.error('[Workflow Trigger] Failed to spawn instance:', instErr)
          return null
        }

        return instance
      })
    )

    const validInstances = spawnedInstances.filter(Boolean)

    return NextResponse.json({
      success: true,
      triggeredCount: validInstances.length,
      instances: validInstances
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
