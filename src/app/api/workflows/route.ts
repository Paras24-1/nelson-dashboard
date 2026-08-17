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
      // If table doesn't exist yet, return empty list instead of throwing
      if (error.code === '42P01') {
        return NextResponse.json([])
      }
      throw error
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
    const { name, trigger_event, is_active, steps } = body

    if (!name || !trigger_event || !Array.isArray(steps)) {
      return NextResponse.json(
        { error: 'Missing required parameters: name, trigger_event, steps' },
        { status: 400 }
      )
    }

    const { data: workflow, error } = await supabaseAdmin
      .from('workflow_definitions')
      .insert({
        org_id: orgId,
        name,
        trigger_event,
        is_active: is_active ?? true,
        steps
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(workflow)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
