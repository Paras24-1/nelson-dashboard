import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const profile = await getUserProfile(req)
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, orgId, role } = profile
    const isStaffEmployee = role !== 'owner' && role !== 'admin'

    const { searchParams } = new URL(req.url)
    const search       = searchParams.get('search')        || ''
    const stage        = searchParams.get('stage')         || ''
    const unread       = searchParams.get('unread')        === 'true'
    const assignedTo   = searchParams.get('assigned_to')   || ''
    const assignFilter = searchParams.get('assign_filter') || ''

    let query = supabaseAdmin
      .from('conversations')
      .select('*, lead:leads(*)')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })

    if (isStaffEmployee) {
      // Non-admin employee is strictly restricted to conversations assigned to them
      query = query.eq('assigned_to', userId)
    } else {
      if (assignedTo) query = query.eq('assigned_to', assignedTo)
      if (assignFilter === 'unassigned') query = query.is('assigned_to', null)
      else if (assignFilter === 'assigned') query = query.not('assigned_to', 'is', null)
      else if (assignFilter && assignFilter !== 'all') query = query.eq('assigned_to', assignFilter)
    }

    if (search) query = query.or(`phone_number.ilike.%${search}%,name.ilike.%${search}%`)
    if (stage)  query = query.eq('stage', stage)
    if (unread) query = query.gt('unread_count', 0)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}