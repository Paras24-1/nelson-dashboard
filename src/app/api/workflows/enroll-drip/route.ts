import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('Authorization')?.replace('Bearer ', '')
    if (secret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { lead_id } = await req.json()
    if (!lead_id) return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 })

    const { data: lead, error: leadError } = await supabaseAdmin.from('leads').select('*').eq('id', lead_id).single()
    if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // Cancel any existing drips for this lead first (prevent duplicates)
    await supabaseAdmin.from('scheduled_drips').update({ status: 'cancelled' }).eq('lead_id', lead.id).eq('status', 'pending')

    // Schedule Step 1 for Right Now
    const { error: insertError } = await supabaseAdmin.from('scheduled_drips').insert({
      lead_id: lead.id,
      org_id: lead.org_id,
      phone_number: lead.phone_number,
      touch_step: 1,
      scheduled_for: new Date().toISOString(), // Step 1 is immediate (Day 0)
      status: 'pending'
    })

    if (insertError) throw insertError

    return NextResponse.json({ success: true, message: `Lead ${lead.id} enrolled in 7-Touch Drip Sequence starting now.` })
  } catch (err: any) {
    console.error('[Enroll Drip API Error]:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
