import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Helper function to fetch and parse Google Sheet CSV
async function fetchGoogleSheetData(sheetId: string, sheetName?: string) {
  try {
    const cleanSheetId = sheetId.trim().replace(/^https:\/\/docs\.google\.com\/spreadsheets\/d\//, '').split('/')[0]
    let url = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/gviz/tq?tqx=out:csv`
    if (sheetName) {
      url += `&sheet=${encodeURIComponent(sheetName)}`
    }

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Google Sheet fetch failed with status ${res.status}`)
    }

    const csvText = await res.text()
    if (!csvText || csvText.includes('<!DOCTYPE html>')) {
      throw new Error('Google Sheet is not public. Please set Sharing to "Anyone with the link can view".')
    }

    // Basic CSV parser
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length === 0) return { rows: [], markdown: '', json: [] }

    const parseCsvLine = (line: string) => {
      const result: string[] = []
      let cur = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          inQuotes = !inQuotes
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ''))
          cur = ''
        } else {
          cur += c
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, ''))
      return result
    }

    const headers = parseCsvLine(lines[0])
    const dataRows = lines.slice(1).map(parseCsvLine)

    const jsonItems = dataRows.map((row, idx) => {
      const itemObj: Record<string, string> = { id: String(idx + 1) }
      headers.forEach((h, i) => {
        if (h) itemObj[h] = row[i] || ''
      })
      return itemObj
    })

    // Markdown representation
    const markdownHeader = `| ${headers.join(' | ')} |`
    const markdownSeparator = `| ${headers.map(() => '---').join(' | ')} |`
    const markdownRows = dataRows.map(row => `| ${headers.map((_, i) => row[i] || '').join(' | ')} |`).join('\n')

    const markdown = `### LIVE KNOWLEDGE BASE DATA (${dataRows.length} items)\n${markdownHeader}\n${markdownSeparator}\n${markdownRows}`

    return {
      sheetId: cleanSheetId,
      headers,
      totalRows: dataRows.length,
      markdown,
      json: jsonItems,
      lastSyncedAt: new Date().toISOString()
    }
  } catch (err: any) {
    console.error('[bot-brain] Sheet Sync Error:', err)
    throw new Error(err.message || 'Failed to fetch Google Sheet data')
  }
}

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: settings, error } = await supabaseAdmin
      .from('organization_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    if (error) throw error

    let parsedPromptObj: any = {}
    if (settings?.ai_system_prompt) {
      try {
        if (settings.ai_system_prompt.startsWith('{')) {
          parsedPromptObj = JSON.parse(settings.ai_system_prompt)
        }
      } catch (e) {
        parsedPromptObj = { system_prompt: settings.ai_system_prompt }
      }
    }

    return NextResponse.json({
      engine_mode: parsedPromptObj.engine_mode || (settings?.n8n_inbound_webhook_url ? 'hybrid_n8n' : 'native'),
      ai_provider: parsedPromptObj.ai_provider || 'gemini',
      ai_model_name: parsedPromptObj.ai_model_name || 'gemini-1.5-flash',
      system_prompt: parsedPromptObj.system_prompt || settings?.ai_system_prompt || 'You are an intelligent WhatsApp AI assistant.',
      google_sheet_id: settings?.ai_knowledge_base_sheet_id || settings?.google_sheet_id || '',
      google_sheet_name: settings?.ai_knowledge_base_range || settings?.google_sheet_name || 'Sheet1',
      cached_kb: parsedPromptObj.cached_kb || null,
      gemini_api_key: settings?.gemini_api_key || '',
      openai_api_key: settings?.openai_api_key || '',
      n8n_inbound_webhook_url: settings?.n8n_inbound_webhook_url || ''
    })
  } catch (err: any) {
    console.error('[bot-brain GET error]:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    // 1. Action: Sync Knowledge Base from Google Sheet
    if (action === 'sync_sheet') {
      const { sheet_id, sheet_name } = body
      if (!sheet_id) {
        return NextResponse.json({ error: 'Google Sheet ID or URL is required' }, { status: 400 })
      }

      const syncResult = await fetchGoogleSheetData(sheet_id, sheet_name)

      // Fetch existing settings
      const { data: existing } = await supabaseAdmin
        .from('organization_settings')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle()

      let promptObj: any = {}
      if (existing?.ai_system_prompt && existing.ai_system_prompt.startsWith('{')) {
        try { promptObj = JSON.parse(existing.ai_system_prompt) } catch (e) {}
      } else if (existing?.ai_system_prompt) {
        promptObj.system_prompt = existing.ai_system_prompt
      }

      promptObj.cached_kb = syncResult

      const serializedPrompt = JSON.stringify(promptObj)

      const updateData = {
        ai_knowledge_base_sheet_id: syncResult.sheetId,
        ai_knowledge_base_range: sheet_name || 'Sheet1',
        ai_system_prompt: serializedPrompt
      }

      if (existing) {
        await supabaseAdmin.from('organization_settings').update(updateData).eq('org_id', orgId)
      } else {
        await supabaseAdmin.from('organization_settings').insert({ org_id: orgId, ...updateData })
      }

      return NextResponse.json({
        success: true,
        cached_kb: syncResult
      })
    }

    // 2. Action: Save Bot Brain Settings
    const {
      engine_mode,
      ai_provider,
      ai_model_name,
      system_prompt,
      google_sheet_id,
      google_sheet_name,
      gemini_api_key,
      openai_api_key,
      n8n_inbound_webhook_url,
      cached_kb
    } = body

    const { data: existing } = await supabaseAdmin
      .from('organization_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    let promptObj: any = {}
    if (existing?.ai_system_prompt && existing.ai_system_prompt.startsWith('{')) {
      try { promptObj = JSON.parse(existing.ai_system_prompt) } catch (e) {}
    }

    promptObj.engine_mode = engine_mode || 'native'
    promptObj.ai_provider = ai_provider || 'gemini'
    promptObj.ai_model_name = ai_model_name || 'gemini-1.5-flash'
    promptObj.system_prompt = system_prompt || ''
    if (cached_kb) promptObj.cached_kb = cached_kb

    const serializedPrompt = JSON.stringify(promptObj)

    const payload: any = {
      ai_system_prompt: serializedPrompt,
      ai_knowledge_base_sheet_id: google_sheet_id || null,
      ai_knowledge_base_range: google_sheet_name || 'Sheet1',
      n8n_inbound_webhook_url: n8n_inbound_webhook_url || null
    }

    if (gemini_api_key !== undefined) payload.gemini_api_key = gemini_api_key
    if (openai_api_key !== undefined) payload.openai_api_key = openai_api_key

    if (existing) {
      await supabaseAdmin.from('organization_settings').update(payload).eq('org_id', orgId)
    } else {
      await supabaseAdmin.from('organization_settings').insert({ org_id: orgId, ...payload })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[bot-brain POST error]:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
