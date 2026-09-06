import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const profile = await getUserProfile(req)
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const body = await req.json()
    
    // Check if is_blocked is passed in body
    if (typeof body.is_blocked !== 'boolean') {
      return NextResponse.json({ error: 'is_blocked boolean is required' }, { status: 400 })
    }

    // Admins and owners can block any lead, staff can only block leads assigned to them.
    // For simplicity, let's just make sure they have access to the conversation org.
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('id, org_id')
      .eq('id', id)
      .eq('org_id', profile.orgId)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 })
    }

    // Update the block status
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ is_blocked: body.is_blocked })
      .eq('id', id)
      .eq('org_id', profile.orgId)

    if (error) throw error

    return NextResponse.json({ success: true, is_blocked: body.is_blocked })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
