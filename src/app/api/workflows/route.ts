import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/workflows - Fetch all workflows for tenant org
export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workflows, error } = await supabaseAdmin
      .from('workflow_definitions')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      // Fallback: Read from organization_settings.ai_system_prompt __WORKFLOWS_STORE__
      const { data: settings } = await supabaseAdmin
        .from('organization_settings')
        .select('ai_system_prompt')
        .eq('org_id', orgId)
        .maybeSingle()
      
      const promptStr = settings?.ai_system_prompt || ''
      const match = promptStr.match(/__WORKFLOWS_STORE__=([\s\S]*?)__END_WORKFLOWS_STORE__/)
      let fallbackWorkflows: any[] = []
      if (match) {
        try { fallbackWorkflows = JSON.parse(match[1]) } catch (e) {}
      }
      return NextResponse.json(fallbackWorkflows)
    }

    return NextResponse.json(workflows || [])
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

// POST /api/workflows - Create a new workflow definition
export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, trigger_event, is_active, stop_on_reply, steps } = body

    if (!name || !trigger_event || !Array.isArray(steps)) {
      return NextResponse.json(
        { error: 'Missing required parameters: name, trigger_event, steps' },
        { status: 400 }
      )
    }

    const newWf = {
      id: typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now()),
      org_id: orgId,
      name,
      trigger_event,
      is_active: is_active ?? true,
      stop_on_reply: stop_on_reply ?? true,
      steps,
      created_at: new Date().toISOString()
    }

    const { data: workflow, error } = await supabaseAdmin
      .from('workflow_definitions')
      .insert(newWf)
      .select()
      .single()

    if (error) {
      // Fallback: Store inside organization_settings.ai_system_prompt __WORKFLOWS_STORE__
      const { data: settings } = await supabaseAdmin
        .from('organization_settings')
        .select('ai_system_prompt')
        .eq('org_id', orgId)
        .maybeSingle()

      let promptStr = settings?.ai_system_prompt || ''
      const storeRegex = /__WORKFLOWS_STORE__=([\s\S]*?)__END_WORKFLOWS_STORE__/
      const match = promptStr.match(storeRegex)
      let existingWfs: any[] = []
      if (match) {
        try { existingWfs = JSON.parse(match[1]) } catch (e) {}
      }

      const updatedWorkflows = [newWf, ...existingWfs.filter(w => w.id !== newWf.id)]
      const newStoreStr = `__WORKFLOWS_STORE__=${JSON.stringify(updatedWorkflows)}__END_WORKFLOWS_STORE__`
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

      return NextResponse.json(newWf)
    }

    return NextResponse.json(workflow)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
