import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

// GET: Fetch all contacts for a specific phonebook
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

    const { data: contacts, error } = await supabaseAdmin
      .from('phonebook_contacts')
      .select('*')
      .eq('phonebook_id', phonebookId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(contacts || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

// POST: Add or bulk upload contacts to a phonebook
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const phonebookId = params.id
    const { contacts } = await req.json()

    if (!contacts || !Array.isArray(contacts)) {
      return NextResponse.json({ error: 'Missing parameter: contacts (must be an array)' }, { status: 400 })
    }

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

    // Deduplicate and clean phone numbers
    const contactRows = contacts
      .map((c: any) => {
        let cleanPhone = String(c.phone || '').replace(/\D/g, '')
        if (cleanPhone.length === 10 && /^[6789]/.test(cleanPhone)) {
          cleanPhone = '91' + cleanPhone
        }
        return {
          phonebook_id: phonebookId,
          phone: cleanPhone,
          name: c.name || '',
          variables: c.variables || {}
        }
      })
      .filter((c: any) => c.phone.length >= 10) // Keep only valid length numbers

    if (contactRows.length === 0) {
      return NextResponse.json({ error: 'No valid contacts provided' }, { status: 400 })
    }

    // Batch insert
    const { data, error } = await supabaseAdmin
      .from('phonebook_contacts')
      .insert(contactRows)
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, count: contactRows.length, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

// DELETE: Delete a contact from a phonebook
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const phonebookId = params.id
    const { searchParams } = new URL(req.url)
    const contactId = searchParams.get('contactId')

    if (!contactId) return NextResponse.json({ error: 'Missing query parameter: contactId' }, { status: 400 })

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

    const { error: deleteError } = await supabaseAdmin
      .from('phonebook_contacts')
      .delete()
      .eq('id', contactId)
      .eq('phonebook_id', phonebookId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
