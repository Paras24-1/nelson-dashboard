import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

// GET: Fetch available columns (variables) for a specific phonebook
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const phonebookId = params.id

    // Verify phonebook belongs to this organization
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('phonebooks')
      .select('id')
      .eq('id', phonebookId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (verifyError || !verifyData) {
      return NextResponse.json({ error: 'Phonebook not found or unauthorized' }, { status: 404 })
    }

    // Fetch a single contact to infer the columns
    const { data: contact, error } = await supabaseAdmin
      .from('phonebook_contacts')
      .select('variables')
      .eq('phonebook_id', phonebookId)
      .limit(1)
      .maybeSingle()

    if (error) throw error

    // Standard columns that are always available
    const columns = ['Name']

    if (contact && contact.variables) {
      const customKeys = Object.keys(contact.variables)
      columns.push(...customKeys)
    }

    // Remove duplicates just in case
    const uniqueColumns = Array.from(new Set(columns))

    return NextResponse.json(uniqueColumns)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
