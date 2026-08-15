import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

// GET: List all phonebooks for the active organization
export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: phonebooks, error } = await supabaseAdmin
      .from('phonebooks')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Fetch contact count for each phonebook
    const phonebooksWithCounts = await Promise.all(
      (phonebooks || []).map(async (pb) => {
        const { count, error: countError } = await supabaseAdmin
          .from('phonebook_contacts')
          .select('*', { count: 'exact', head: true })
          .eq('phonebook_id', pb.id)

        if (countError) console.error(`Error counting contacts for phonebook ${pb.id}:`, countError)
        return {
          ...pb,
          contact_count: count || 0
        }
      })
    )

    return NextResponse.json(phonebooksWithCounts)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

// POST: Create a new empty phonebook
export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await req.json()
    if (!name) return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('phonebooks')
      .insert({
        org_id: orgId,
        name
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ...data, contact_count: 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

// DELETE: Delete a phonebook (RLS is also checked via org_id scoping)
export async function DELETE(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing query parameter: id' }, { status: 400 })

    // Verify phonebook belongs to this organization
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('phonebooks')
      .select('id')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (verifyError || !verifyData) {
      return NextResponse.json({ error: 'Phonebook not found or unauthorized' }, { status: 404 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('phonebooks')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
