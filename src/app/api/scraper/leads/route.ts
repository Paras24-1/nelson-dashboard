import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('job_id')
    if (!jobId) return NextResponse.json({ error: 'job_id required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('scraped_leads')
      .select('*')
      .eq('job_id', jobId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { lead_id } = await req.json()
    if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

    // 1. Fetch the scraped lead
    const { data: scrapedLead, error: fetchError } = await supabaseAdmin
      .from('scraped_leads')
      .select('*')
      .eq('id', lead_id)
      .eq('org_id', orgId)
      .single()

    if (fetchError || !scrapedLead) {
      return NextResponse.json({ error: 'Scraped lead not found' }, { status: 404 })
    }

    if (scrapedLead.imported) {
      return NextResponse.json({ error: 'Lead is already imported to CRM' }, { status: 400 })
    }

    // 2. Clean the phone number format
    let cleanPhone = scrapedLead.phone || ''
    // Strip non-numeric characters for database matching
    const numericPhone = cleanPhone.replace(/\D/g, '')

    // 3. Check if this phone number already exists in CRM leads to prevent duplicates
    if (numericPhone) {
      const last10Digits = numericPhone.slice(-10)
      const { data: existingLead } = await supabaseAdmin
        .from('leads')
        .select('id')
        .ilike('phone_number', `%${last10Digits}`)
        .eq('org_id', orgId)
        .maybeSingle()

      if (existingLead) {
        // Mark as imported anyway to update UI state since it already exists in CRM
        await supabaseAdmin
          .from('scraped_leads')
          .update({ imported: true })
          .eq('id', lead_id)

        return NextResponse.json({ 
          success: true, 
          message: 'Lead phone number already exists in CRM. Marked as imported.',
          existing: true 
        })
      }
    }

    // 4. Insert into main CRM leads
    const metadata = {
      address: scrapedLead.address || '',
      website: scrapedLead.website || '',
      rating: scrapedLead.rating || '',
      reviews_count: scrapedLead.reviews_count || '',
      category: scrapedLead.category || '',
      google_maps_url: scrapedLead.google_maps_url || '',
      scraped_at: scrapedLead.created_at,
      source: 'Google Maps Scraper'
    }

    const { data: newLead, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert({
        org_id: orgId,
        name: scrapedLead.name || 'Scraped Business',
        phone_number: cleanPhone || `Scraped-${scrapedLead.id.slice(0,8)}`,
        stage: 'new',
        lead_quality: 'warm',
        metadata: metadata
      })
      .select()
      .single()

    if (insertError) throw insertError

    // 5. Update scraped_leads imported status
    const { error: updateError } = await supabaseAdmin
      .from('scraped_leads')
      .update({ imported: true })
      .eq('id', lead_id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, lead: newLead })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
