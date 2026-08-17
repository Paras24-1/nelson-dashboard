import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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
    const { name, trigger_event, is_active, steps } = body

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updatePayload.name = name
    if (trigger_event !== undefined) updatePayload.trigger_event = trigger_event
    if (is_active !== undefined) updatePayload.is_active = is_active
    if (steps !== undefined) updatePayload.steps = steps

    const { data: updated, error } = await supabaseAdmin
      .from('workflow_definitions')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error

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

    if (error) throw error

    return NextResponse.json({ success: true, deleted: data?.[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
