import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/workflows/trigger - Receives system event and starts matching workflows
export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { event_type, lead_id, phone_number, lead_name, contacts, metadata } = body

    if (!event_type) {
      return NextResponse.json(
        { error: 'Missing required parameter: event_type' },
        { status: 400 }
      )
    }

    // Build normalized list of contacts
    let targetContacts: { phone: string; name?: string; id?: string }[] = []
    if (Array.isArray(contacts) && contacts.length > 0) {
      targetContacts = contacts.map(c => typeof c === 'string' ? { phone: c } : { phone: c.phone || c.phone_number || '', name: c.name || c.contact_person, id: c.id })
    } else if (phone_number || lead_id) {
      targetContacts = [{ phone: phone_number || '', name: lead_name || 'Lead', id: lead_id }]
    }

    if (targetContacts.length === 0) {
      return NextResponse.json({ message: 'No target contacts provided', triggeredCount: 0 })
    }

    // 1. Fetch active workflows for this org matching the trigger event
    let activeWorkflows: any[] = []
    const { data: dbWorkflows, error: wfError } = await supabaseAdmin
      .from('workflow_definitions')
      .select('*')
      .eq('org_id', orgId)
      .eq('trigger_event', event_type)
      .eq('is_active', true)

    if (!wfError && dbWorkflows) {
      activeWorkflows = dbWorkflows
    } else {
      // Fallback: Read workflows from organization_settings
      const { data: settings } = await supabaseAdmin
        .from('organization_settings')
        .select('metadata')
        .eq('org_id', orgId)
        .maybeSingle()
      
      const allWfs: any[] = settings?.metadata?.workflows || []
      activeWorkflows = allWfs.filter(w => w.trigger_event === event_type && w.is_active)
    }

    if (activeWorkflows.length === 0) {
      return NextResponse.json({ message: 'No active workflows for event', triggeredCount: 0 })
    }

    // 2. Spawn workflow instances for each matching active workflow and target contact
    const createdInstances: any[] = []

    for (const wf of activeWorkflows) {
      const steps = wf.steps || []
      if (steps.length === 0) continue

      const firstStep = steps[0]
      let nextRunAt = new Date().toISOString()
      if (firstStep.type === 'delay') {
        const delayMinutes = parseInt(firstStep.delay_minutes || '0')
        nextRunAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
      }

      for (const contact of targetContacts) {
        const cleanPhone = String(contact.phone || '').replace(/\D/g, '')
        if (!cleanPhone) continue

        const instPayload = {
          id: typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now()) + Math.random(),
          workflow_id: wf.id,
          org_id: orgId,
          contact_id: contact.id || null,
          phone_number: cleanPhone,
          lead_name: contact.name || 'Lead',
          current_step_index: 0,
          status: firstStep.type === 'delay' ? 'pending' : 'active',
          next_run_at: nextRunAt,
          stop_on_reply: wf.stop_on_reply ?? true,
          metadata: metadata || {},
          created_at: new Date().toISOString()
        }

        const { data: instance, error: instErr } = await supabaseAdmin
          .from('workflow_instances')
          .insert(instPayload)
          .select()
          .single()

        if (instErr) {
          // Fallback: append to organization_settings.metadata.workflow_instances
          const { data: settings } = await supabaseAdmin
            .from('organization_settings')
            .select('metadata')
            .eq('org_id', orgId)
            .maybeSingle()

          const currentMeta = settings?.metadata || {}
          const currentInstances: any[] = currentMeta.workflow_instances || []
          const updatedInstances = [instPayload, ...currentInstances]

          await supabaseAdmin
            .from('organization_settings')
            .upsert({
              org_id: orgId,
              metadata: { ...currentMeta, workflow_instances: updatedInstances }
            })

          createdInstances.push(instPayload)
        } else {
          createdInstances.push(instance)
        }
      }
    }

    return NextResponse.json({
      success: true,
      triggeredCount: createdInstances.length,
      instances: createdInstances
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
