import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const profile = await getUserProfile(req)
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, orgId, role } = profile
    const isStaffEmployee = role !== 'owner' && role !== 'admin'

    const searchParams = new URL(req.url).searchParams
    const stage = searchParams.get('stage') || ''
    const quality = searchParams.get('quality') || ''
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''

    let allLeads: any[] = []
    let pageNum = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      let query = supabaseAdmin
        .from('leads')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)

      if (isStaffEmployee) {
        query = query.eq('assigned_to', userId)
      }

      if (stage) {
        query = query.eq('stage', stage)
      }
      if (quality) {
        query = query.eq('lead_quality', quality)
      }
      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', `${endDate}T23:59:59.999Z`)
      }

      const { data, error } = await query
      if (error) throw error

      if (!data || data.length === 0) {
        hasMore = false
      } else {
        allLeads = [...allLeads, ...data]
        if (data.length < pageSize) {
          hasMore = false
        } else {
          pageNum++
        }
      }
    }

    // Safely parse metadata on each lead and flatten key fields for API consistency
    const parsedLeads = allLeads.map((lead) => {
      let parsedMetadata: Record<string, any> = {}
      if (lead.metadata) {
        if (typeof lead.metadata === 'string') {
          try {
            parsedMetadata = JSON.parse(lead.metadata)
          } catch {}
        } else if (typeof lead.metadata === 'object') {
          parsedMetadata = lead.metadata
        }
      }

      const score = Number(parsedMetadata.lead_score ?? lead.lead_score) || 0;
      let quality = (parsedMetadata.lead_quality || parsedMetadata.lead_temperature || lead.lead_temperature || 'cold').toLowerCase();
      if (score >= 70) quality = 'hot';
      else if (score >= 40) quality = 'warm';
      else if (score > 0) quality = 'cold';

      const stage = parsedMetadata.state || parsedMetadata.stage || lead.stage || 'new';
      const displayName = lead.name || lead.customer_name || parsedMetadata.Name || parsedMetadata.name || parsedMetadata.contact_person || parsedMetadata.customer_name || 'Unknown';

      return {
        ...lead,
        ...parsedMetadata,
        name: displayName,
        stage: stage,
        lead_quality: quality,
        lead_temperature: quality.toUpperCase(),
        lead_score: score,
        metadata: parsedMetadata
      }
    })

    let filteredLeads = parsedLeads

    // In-memory search for maximum flexibility (searches metadata keys and values too)
    if (search) {
      const searchLower = search.toLowerCase()
      filteredLeads = parsedLeads.filter((lead) => {
        const nameMatch = (lead.name || '').toLowerCase().includes(searchLower)
        const phoneMatch = (lead.phone_number || '').toLowerCase().includes(searchLower)
        const stageMatch = (lead.stage || '').toLowerCase().includes(searchLower)
        const qualityMatch = (lead.lead_quality || '').toLowerCase().includes(searchLower)

        let metadataMatch = false
        if (lead.metadata) {
          metadataMatch = Object.entries(lead.metadata).some(([key, val]) =>
            key.toLowerCase().includes(searchLower) ||
            String(val).toLowerCase().includes(searchLower)
          )
        }

        return nameMatch || phoneMatch || stageMatch || qualityMatch || metadataMatch
      })
    }

    return NextResponse.json(filteredLeads)
  } catch (err: unknown) {
    console.error('[leads-list]', err)
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
