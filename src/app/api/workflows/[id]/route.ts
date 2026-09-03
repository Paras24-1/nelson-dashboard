import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Helper to read workflows from store
async function getWorkflowsFromStore(orgId: string): Promise<any[]> {
  const { data: settings } = await supabaseAdmin
    .from('organization_settings')
    .select('ai_system_prompt')
    .eq('org_id', orgId)
    .maybeSingle()
  
  const promptStr = settings?.ai_system_prompt || ''
  const match = promptStr.match(/__WORKFLOWS_STORE__=([\s\S]*?)__END_WORKFLOWS_STORE__/)
  if (match) {
    try { return JSON.parse(match[1]) } catch (e) {}
  }
  return []
}

// Helper to save workflows to store
async function saveWorkflowsToStore(orgId: string, workflows: any[]): Promise<void> {
  const { data: settings } = await supabaseAdmin
    .from('organization_settings')
    .select('ai_system_prompt')
    .eq('org_id', orgId)
    .maybeSingle()

  let promptStr = settings?.ai_system_prompt || ''
  const storeRegex = /__WORKFLOWS_STORE__=([\s\S]*?)__END_WORKFLOWS_STORE__/
  const newStoreStr = `__WORKFLOWS_STORE__=${JSON.stringify(workflows)}__END_WORKFLOWS_STORE__`
  
  let newPrompt = promptStr
  if (storeRegex.test(newPrompt)) {
    newPrompt = newPrompt.replace(storeRegex, newStoreStr)
  } else {
    newPrompt += `\n\n${newStoreStr}`
  }

  await supabaseAdmin
    .from('organization_settings')
    .update({ ai_system_prompt: newPrompt })
    .eq('org_id', orgId)
}

// GET /api/workflows/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workflow, error } = await supabaseAdmin
      .from('workflow_definitions')
      .select('*')
      .eq('id', params.id)
      .eq('org_id', orgId)
      .single()

    if (error || !workflow) {
      const storeWfs = await getWorkflowsFromStore(orgId)
      const found = storeWfs.find(w => w.id === params.id)
      if (found) return NextResponse.json(found)
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json(workflow)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

// PUT /api/workflows/[id] - Update workflow steps, status or name
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, trigger_event, is_active, stop_on_reply, steps } = body

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updatePayload.name = name
    if (trigger_event !== undefined) updatePayload.trigger_event = trigger_event
    if (is_active !== undefined) updatePayload.is_active = is_active
    if (stop_on_reply !== undefined) updatePayload.stop_on_reply = stop_on_reply
    if (steps !== undefined) updatePayload.steps = steps

    const { data: updated, error } = await supabaseAdmin
      .from('workflow_definitions')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) {
      // Fallback update in store
      const storeWfs = await getWorkflowsFromStore(orgId)
      let targetWf = storeWfs.find(w => w.id === params.id)
      if (!targetWf) {
        targetWf = { id: params.id, org_id: orgId, created_at: new Date().toISOString() }
        storeWfs.unshift(targetWf)
      }
      Object.assign(targetWf, updatePayload)
      await saveWorkflowsToStore(orgId, storeWfs)
      return NextResponse.json(targetWf)
    }

    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

// DELETE /api/workflows/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('workflow_definitions')
      .delete()
      .eq('id', params.id)
      .eq('org_id', orgId)
      .select()

    if (error) {
      // Fallback delete from store
      const storeWfs = await getWorkflowsFromStore(orgId)
      const filtered = storeWfs.filter(w => w.id !== params.id)
      await saveWorkflowsToStore(orgId, filtered)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true, deleted: data?.[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
