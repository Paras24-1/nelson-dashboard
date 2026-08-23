import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: rows, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'canned_reply')
      .order('created_at', { ascending: false })

    if (error) throw error

    const cannedReplies = (rows || []).map((row: any) => {
      let parsedBody: any = {}
      try {
        parsedBody = JSON.parse(row.template_body || '{}')
      } catch (e) {
        parsedBody = { content: row.template_body }
      }

      return {
        id: row.id,
        shortcut: row.name,
        title: parsedBody.title || row.name,
        type: parsedBody.type || (row.template_name ? row.template_name.replace('canned:', '') : 'text'),
        content: parsedBody.content || '',
        media_url: parsedBody.media_url || null,
        filename: parsedBody.filename || null,
        location_data: parsedBody.location_data || null,
        created_at: row.created_at
      }
    })

    return NextResponse.json(cannedReplies)
  } catch (err: any) {
    console.error('[canned-replies GET error]:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { shortcut, title, type, content, media_url, filename, location_data } = body

    if (!shortcut) {
      return NextResponse.json({ error: 'Shortcut name is required' }, { status: 400 })
    }

    const cleanShortcut = shortcut.replace(/^\//, '').trim().toLowerCase()
    const cleanType = type || 'text'

    const payloadObj = {
      shortcut: cleanShortcut,
      title: title || cleanShortcut,
      type: cleanType,
      content: content || '',
      media_url: media_url || null,
      filename: filename || null,
      location_data: location_data || null
    }

    const { data: inserted, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        org_id: orgId,
        name: cleanShortcut,
        template_name: `canned:${cleanType}`,
        template_body: JSON.stringify(payloadObj),
        status: 'canned_reply'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      id: inserted.id,
      ...payloadObj,
      created_at: inserted.created_at
    })
  } catch (err: any) {
    console.error('[canned-replies POST error]:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, shortcut, title, type, content, media_url, filename, location_data } = body

    if (!id || !shortcut) {
      return NextResponse.json({ error: 'ID and Shortcut are required' }, { status: 400 })
    }

    const cleanShortcut = shortcut.replace(/^\//, '').trim().toLowerCase()
    const cleanType = type || 'text'

    const payloadObj = {
      shortcut: cleanShortcut,
      title: title || cleanShortcut,
      type: cleanType,
      content: content || '',
      media_url: media_url || null,
      filename: filename || null,
      location_data: location_data || null
    }

    const { data: updated, error } = await supabaseAdmin
      .from('campaigns')
      .update({
        name: cleanShortcut,
        template_name: `canned:${cleanType}`,
        template_body: JSON.stringify(payloadObj)
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      id: updated.id,
      ...payloadObj,
      updated_at: new Date().toISOString()
    })
  } catch (err: any) {
    console.error('[canned-replies PUT error]:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    if (error) throw error

    return NextResponse.json({ success: true, id })
  } catch (err: any) {
    console.error('[canned-replies DELETE error]:', err)
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
