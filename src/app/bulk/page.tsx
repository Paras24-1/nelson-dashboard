'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Papa from 'papaparse'
import Link from "next/link"
import * as XLSX from 'xlsx'
import {
  Upload, Send, Filter, Clock, BarChart2,
  CheckCircle, XCircle, AlertCircle, RefreshCw,
  Download, Pause, MessageSquare, TrendingUp, X, Plus, Eye,
  Trash2, FileText, BookOpen
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import { useOrg } from '@/contexts/OrgContext'

interface Contact {
  phone: string
  name: string
  [key: string]: string
}

interface Campaign {
  id: string
  name: string
  template_name: string
  template_body: string
  phonebook_name?: string | null
  status: 'draft' | 'sending' | 'paused' | 'completed' | 'failed'
  total: number
  sent: number
  delivered: number
  failed: number
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface FilterItem {
  column: string
  value: string
}

interface Template {
  id: string
  name: string
  language: string
  status: string
  category: string
  body: string
  header: string
  header_format?: string | null
  footer: string
  variables: string[]
}

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  sending:   'bg-blue-100 text-blue-700',
  paused:    'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
}

const STATUS_ICONS = {
  draft:     <Clock className="w-3.5 h-3.5" />,
  sending:   <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
  paused:    <Pause className="w-3.5 h-3.5" />,
  completed: <CheckCircle className="w-3.5 h-3.5" />,
  failed:    <XCircle className="w-3.5 h-3.5" />,
}

// ── Helpers ────────────────────────────────────────────────────
function extractVariables(body: string): string[] {
  const matches = body.match(/{{\s*[\w]+\s*}}/g) || []
  return Array.from(new Set(matches.map((m) => m.replace(/\s/g, '')))).sort()
}

function buildPreview(body: string, mapping: Record<string, string>, sampleContact: Contact): string {
  let preview = body
  Object.entries(mapping).forEach(([variable, column]) => {
    const value = column ? (sampleContact[column] || column) : `[${variable}]`
    const escaped = variable.replace(/[{}]/g, '\\$&')
    const pattern = escaped.replace(/\\\{(\\\{)/, '\\{\\{\\s*').replace(/(\\\})\\\}/, '\\s*\\}\\}')
    preview = preview.replace(new RegExp(pattern, 'g'), value)
  })
  return preview
}

function cleanPhoneNumber(val: any): string {
  if (val === null || val === undefined) return ''
  
  if (typeof val === 'number') {
    return String(Math.floor(val))
  }
  
  let str = String(val).trim()
  
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
    const num = Number(str)
    if (!isNaN(num)) {
      return String(Math.floor(num))
    }
  }
  
  if (str.includes('.')) {
    const parts = str.split('.')
    if (/^0+$/.test(parts[1])) {
      str = parts[0]
    } else {
      const num = Number(str)
      if (!isNaN(num)) {
        return String(Math.floor(num))
      }
    }
  }
  
  return str.replace(/\D/g, '')
}

function findPhoneKey(cols: string[]): string {
  const firstPriority = cols.find(c => {
    const l = c.toLowerCase()
    return l.includes('phone') || l.includes('mobile') || l.includes('contact') || l.includes('whatsapp') || l.includes('tele')
  })
  if (firstPriority) return firstPriority

  const secondPriority = cols.find(c => {
    const l = c.toLowerCase()
    return l.includes('number') && !l.includes('sr') && !l.includes('serial') && !l.includes('id') && !l.includes('no')
  })
  if (secondPriority) return secondPriority

  return cols[0]
}

function findNameKey(cols: string[], phoneKey: string): string {
  const nameCol = cols.find(c => c.toLowerCase().includes('name'))
  if (nameCol) return nameCol

  const fallback = cols.find(c => c !== phoneKey)
  return fallback || cols[1] || cols[0]
}


// ── Main Page ──────────────────────────────────────────────────
export default function BulkMessagingPage() {
  const [tab, setTab]             = useState<'new' | 'history' | 'phonebooks'>('history')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  const fetchCampaigns = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: HeadersInit = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
    const res = await fetch('/api/campaigns', { headers })
  
    if (res.ok) {
      setCampaigns(await res.json())
    }
  }, [])

  useEffect(() => {
    fetchCampaigns()
    const channel = supabase
      .channel('campaigns-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, fetchCampaigns)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCampaigns])

  const stats = {
    total:     campaigns.length,
    sending:   campaigns.filter((c) => c.status === 'sending').length,
    completed: campaigns.filter((c) => c.status === 'completed').length,
    delivered: campaigns.reduce((a, c) => a + c.delivered, 0),
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sidebar />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Messaging</h1>
              <p className="text-sm text-gray-500 mt-0.5">Send WhatsApp template messages to multiple contacts</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTab('phonebooks')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'phonebooks' ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
              <BookOpen className="w-4 h-4" />Phonebooks
            </button>
            <button onClick={() => setTab('new')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'new' ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
              <Plus className="w-4 h-4" />New Campaign
            </button>
            <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'history' ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
              <BarChart2 className="w-4 h-4" />Campaign History
            </button>
          </div>
        </div>
      </div>
  
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<MessageSquare className="w-5 h-5 text-blue-500" />}  label="Total Campaigns" value={stats.total} />
          <StatCard icon={<RefreshCw    className="w-5 h-5 text-amber-500" />}  label="Active"          value={stats.sending} />
          <StatCard icon={<CheckCircle  className="w-5 h-5 text-green-500" />}  label="Completed"       value={stats.completed} />
          <StatCard icon={<TrendingUp   className="w-5 h-5 text-emerald-500" />} label="Total Delivered" value={stats.delivered} />
        </div>
        {tab === 'new' && (
          <NewCampaign onCreated={() => { fetchCampaigns(); setTab('history') }} />
        )}
        {tab === 'history' && (
          <CampaignHistory campaigns={campaigns} onRefresh={fetchCampaigns} />
        )}
        {tab === 'phonebooks' && (
          <PhonebooksTab />
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-950 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
    </div>
  )
}

// ── New Campaign ───────────────────────────────────────────────
function NewCampaign({ onCreated }: { onCreated: () => void }) {
  const { profile } = useOrg()
  const [step, setStep]                         = useState(1)
  const [allContacts, setAllContacts]           = useState<Contact[]>([])
  const [columns, setColumns]                   = useState<string[]>([])
  const [filters, setFilters]                   = useState<FilterItem[]>([])
  const [filteredContacts, setFiltered]         = useState<Contact[]>([])
  const [campaignName, setCampaignName]         = useState('')
  const [templateName, setTemplateName]         = useState('')
  const [templateBody, setTemplateBody]         = useState('')
  const [scheduledAt, setScheduledAt]           = useState('')
  const [sending, setSending]                   = useState(false)
  const [gsUrl, setGsUrl]                       = useState('')
  const [loadingGs, setLoadingGs]               = useState(false)
  const [templates, setTemplates]               = useState<Template[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [variableMapping, setVariableMapping]   = useState<Record<string, string>>({})
  const [headerImageUrl, setHeaderImageUrl]     = useState('')
  const [uploadingImage, setUploadingImage]     = useState(false)
  
  // Phonebooks integrations
  const [phonebooks, setPhonebooks]             = useState<any[]>([])
  const [selectedPhonebookId, setSelectedPhonebookId] = useState('')
  const [loadingPhonebooks, setLoadingPhonebooks] = useState(false)
  const [saveAsPhonebook, setSaveAsPhonebook]       = useState(false)
  const [phonebookNameInput, setPhonebookNameInput] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)

  // Fetch phonebooks on mount
  useEffect(() => {
    const fetchPhonebooksList = async () => {
      setLoadingPhonebooks(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const headers: HeadersInit = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
        const res = await fetch('/api/phonebooks', { headers })
        if (res.ok) {
          setPhonebooks(await res.json())
        }
      } catch (err) {
        console.error('Failed to load phonebooks:', err)
      } finally {
        setLoadingPhonebooks(false)
      }
    }
    fetchPhonebooksList()
  }, [])

  const loadPhonebookContacts = async (phonebookId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      const res = await fetch(`/api/phonebooks/${phonebookId}/contacts`, { headers })
      if (!res.ok) throw new Error('Failed to load contacts')
      const data = await res.json()
      
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map((c: any) => ({
          phone: c.phone,
          name: c.name,
          ...c.variables
        }))
        
        const first = data[0]
        const keys = ['phone', 'name', ...Object.keys(first.variables || {})]
        
        setColumns(keys)
        setAllContacts(mapped)
        setStep(2)
      } else {
        alert('This phonebook is empty.')
        setAllContacts([])
      }
    } catch (err: any) {
      alert(`Error loading phonebook contacts: ${err.message}`)
    }
  }

  // Fetch templates on step 3
  useEffect(() => {
    if (step === 3 && templates.length === 0) {
      setLoadingTemplates(true)
      supabase.auth.getSession().then(({ data: { session } }) => {
        const headers: HeadersInit = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
        fetch('/api/templates', { headers })
          .then(async (r) => {
            const data = await r.json()
            if (!r.ok) {
              throw new Error(data.error || 'Failed to fetch templates')
            }
            return data
          })
          .then((data) => {
            if (Array.isArray(data)) {
              setTemplates(data)
            } else {
              console.error('Templates response is not an array:', data)
              alert('Templates error: Invalid format received')
            }
          })
          .catch((err) => {
            console.error('Fetch templates error:', err)
            alert(`Failed to load templates: ${err.message || String(err)}`)
          })
          .finally(() => setLoadingTemplates(false))
      })
    }
  }, [step, templates.length])

  // When template is selected, auto-initialize variable mapping
  useEffect(() => {
    if (!selectedTemplate) return
    const vars = extractVariables(selectedTemplate.body)
    const defaultMapping: Record<string, string> = {}
    vars.forEach((v, i) => {
      if (i === 0) {
        const nameCol = columns.find((c) => c.toLowerCase() === 'name' || c.toLowerCase().includes('name'))
        defaultMapping[v] = nameCol || columns[0] || ''
      } else {
        defaultMapping[v] = ''
      }
    })
    setVariableMapping(defaultMapping)
  }, [selectedTemplate, columns])

  // Apply filters
  useEffect(() => {
    if (!allContacts.length) { setFiltered([]); return }
    let result = [...allContacts]
    for (const f of filters) {
      if (f.column && f.value) {
        result = result.filter((c) =>
          (c[f.column] || '').toLowerCase().includes(f.value.toLowerCase())
        )
      }
    }
    setFiltered(result)
  }, [allContacts, filters])

  const parseFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => loadContacts(r.data as Contact[]) })
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = e.target?.result
        if (data) {
          const wb = XLSX.read(data, { type: 'array' })
          loadContacts(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as Contact[])
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const loadContacts = (data: Contact[]) => {
    if (!data.length) return
    const cols = Object.keys(data[0])
    setColumns(cols)
    const phoneKey = findPhoneKey(cols)
    const nameKey  = findNameKey(cols, phoneKey)

    const normalized = data.map((row) => {
      return { 
        ...row, 
        phone: cleanPhoneNumber(row[phoneKey]), 
        name: String(row[nameKey] || '') 
      }
    }).filter((c) => c.phone.length >= 10)

    // Deduplicate by phone number to prevent database unique constraint violations
    const uniqueMap = new Map<string, Contact>()
    normalized.forEach((c) => {
      if (!uniqueMap.has(c.phone)) {
        uniqueMap.set(c.phone, c)
      }
    })
    const uniqueContacts = Array.from(uniqueMap.values())

    setAllContacts(uniqueContacts)
    setStep(2)
  }

  const importFromGoogleSheets = async () => {
    if (!gsUrl) return
    setLoadingGs(true)
    try {
      const match = gsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
      if (!match) { alert('Invalid Google Sheets URL'); return }
      const res  = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${match[1]}/values/A:Z?key=${process.env.NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY}`)
      const data = await res.json()
      if (!data.values?.length) { alert('No data found'); return }
      const headers = data.values[0]
      loadContacts(data.values.slice(1).map((row: string[]) => {
        const obj: Contact = { phone: '', name: '' }
        headers.forEach((h: string, i: number) => { obj[h] = row[i] || '' })
        return obj
      }))
    } catch { alert('Failed to import') }
    finally { setLoadingGs(false) }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const orgId = profile?.org_id
      if (!orgId) {
        throw new Error('User organization not found')
      }

      const extension = file.name.split('.').pop() || ''
      const baseName = file.name
        .substring(0, file.name.lastIndexOf('.'))
        .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace anything except alphanumeric, dash, and underscore
      const baseFilename = `bulk-headers/${Date.now()}-${baseName}.${extension}`
      const filename = `${orgId}/${baseFilename}`

      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(filename, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true,
        })

      if (error) {
        throw error
      }

      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filename)

      if (urlData?.publicUrl) {
        setHeaderImageUrl(urlData.publicUrl)
      } else {
        alert('Failed to upload media file')
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message || String(err)}`)
    } finally {
      setUploadingImage(false)
    }
  }

  const addFilter    = () => setFilters([...filters, { column: '', value: '' }])
  const removeFilter = (i: number) => setFilters(filters.filter((_, idx) => idx !== i))
  const updateFilter = (i: number, key: keyof FilterItem, val: string) =>
    setFilters(filters.map((f, idx) => idx === i ? { ...f, [key]: val } : f))

  const handleSend = async () => {
    if (!campaignName || !templateName || !filteredContacts.length) return
  
    setSending(true)
  
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      }

      let activePhonebookName = ''

      // If user selected "Save contacts as a new Phonebook"
      if (saveAsPhonebook && filteredContacts.length > 0) {
        const pbName = phonebookNameInput.trim() || campaignName || `Phonebook - ${new Date().toLocaleDateString()}`
        try {
          const pbRes = await fetch('/api/phonebooks', {
            method: 'POST',
            headers,
            body: JSON.stringify({ name: pbName })
          })
          if (pbRes.ok) {
            const pbData = await pbRes.json()
            if (pbData?.id) {
              activePhonebookName = pbName
              // Upload contacts to the newly created phonebook
              const contactsPayload = filteredContacts.map((c) => {
                const { phone, name, ...restVars } = c
                return {
                  phone,
                  name: name || '',
                  variables: restVars
                }
              })
              await fetch(`/api/phonebooks/${pbData.id}/contacts`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ contacts: contactsPayload })
              })
            }
          }
        } catch (pbErr) {
          console.error('Error auto-creating phonebook:', pbErr)
        }
      }

      // If loaded from an existing selected phonebook, pull its name
      if (!activePhonebookName && selectedPhonebookId) {
        const foundPb = phonebooks.find(p => p.id === selectedPhonebookId)
        if (foundPb) activePhonebookName = foundPb.name
      }

      console.log('Sending campaign payload:', {
        name: campaignName,
        template_name: templateName,
        template_language: selectedTemplate?.language || 'en',
        phonebook_name: activePhonebookName
      })

      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: campaignName,
          template_name: templateName,
          template_body: templateBody,
          template_language: selectedTemplate?.language || 'en',
          phonebook_name: activePhonebookName || null,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          variable_mapping: variableMapping,
          header_image_url: headerImageUrl || '',
          contacts: filteredContacts.map((c) => {
            const resolvedVars: Record<string, string> = {}
            Object.entries(variableMapping).forEach(([variable, column]) => {
              resolvedVars[variable] = column ? c[column] || '' : ''
            })
  
            return {
              phone: c.phone,
              name: c.name,
              variables: resolvedVars,
              raw: c
            }
          })
        })
      })
  
      if (res.ok) {
        onCreated()
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(`Failed to create campaign: ${errorData.error || 'Unknown server error'}`)
      }
    } catch (err: any) {
      alert(`Failed to create campaign: ${err.message || String(err)}`)
    } finally {
      setSending(false)
    }
  }

  const templateVariables = selectedTemplate ? extractVariables(selectedTemplate.body) : []
  const sampleContact     = filteredContacts[0] || {} as Contact
  const previewText       = selectedTemplate
    ? buildPreview(selectedTemplate.body, variableMapping, sampleContact)
    : ''

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">

        {/* Step 1: Upload */}
        <StepCard number={1} title="Upload Contacts" active={step >= 1} complete={step > 1}>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-400 transition-colors"
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop CSV or Excel file here</p>
            <p className="text-xs text-gray-400 mt-1">Supports .csv, .xlsx, .xls</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
          </div>

          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <span className="text-xs text-gray-400">or import from Google Sheets</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>

          <div className="flex gap-2">
            <input type="text" placeholder="Paste Google Sheets URL..." value={gsUrl}
              onChange={(e) => setGsUrl(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={importFromGoogleSheets} disabled={!gsUrl || loadingGs}
              className="px-4 py-2 bg-emerald-500 text-white text-sm rounded-xl hover:bg-emerald-600 disabled:opacity-50 font-medium">
              {loadingGs ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Import'}
            </button>
          </div>

          {phonebooks.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                <span className="text-xs text-gray-400">or use saved Phonebook</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedPhonebookId}
                  onChange={(e) => {
                    const id = e.target.value
                    setSelectedPhonebookId(id)
                    if (id) loadPhonebookContacts(id)
                  }}
                  className="flex-1 px-3 py-2 text-sm rounded-xl bg-gray-150 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Select Phonebook --</option>
                  {phonebooks.map((pb) => (
                    <option key={pb.id} value={pb.id}>
                      {pb.name} ({pb.contact_count} contacts)
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {allContacts.length > 0 && (
            <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-between">
              <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">✓ {allContacts.length} contacts loaded</span>
              <button onClick={() => { setAllContacts([]); setStep(1) }} className="text-xs text-gray-400 hover:text-red-500">Clear</button>
            </div>
          )}
        </StepCard>

        {/* Step 2: Filter */}
        {step >= 2 && (
          <StepCard number={2} title="Filter Contacts" active complete={step > 2}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">{filteredContacts.length}</span> of {allContacts.length} contacts selected
              </p>
              <button onClick={addFilter} className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-600">
                <Filter className="w-3 h-3" /> Add Filter
              </button>
            </div>

            {filters.map((f, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select value={f.column} onChange={(e) => updateFilter(i, 'column', e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none">
                  <option value="">Select column</option>
                  {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="text" placeholder="Filter value..." value={f.value}
                  onChange={(e) => updateFilter(i, 'value', e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none" />
                <button onClick={() => removeFilter(i)} className="text-gray-400 hover:text-red-500 px-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Phone</th>
                    <th className="px-3 py-2 text-left text-gray-500 font-medium">Name</th>
                    {columns.filter((c) => c !== 'phone' && c !== 'name').slice(0, 2).map((c) => (
                      <th key={c} className="px-3 py-2 text-left text-gray-500 font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.slice(0, 6).map((c, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{c.phone}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{c.name}</td>
                      {columns.filter((col) => col !== 'phone' && col !== 'name').slice(0, 2).map((col) => (
                        <td key={col} className="px-3 py-2 text-gray-500 truncate max-w-[100px]">{c[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredContacts.length > 6 && (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
                  +{filteredContacts.length - 6} more contacts
                </div>
              )}
            </div>

            <button onClick={() => setStep(3)} disabled={!filteredContacts.length}
              className="mt-3 w-full py-2 bg-emerald-500 text-white text-sm rounded-xl hover:bg-emerald-600 disabled:opacity-40 font-medium">
              Continue with {filteredContacts.length} contacts →
            </button>
          </StepCard>
        )}

        {/* Step 3: Template + Variable Mapping */}
        {step >= 3 && (
          <StepCard number={3} title="Configure Template" active complete={step > 3}>
            <div className="space-y-4">

              {/* Campaign Name */}
              <div>
                <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Campaign Name</label>
                <input type="text" placeholder="e.g. March Service Reminder" value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              {/* Template Dropdown */}
              <div>
                <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Select Template</label>
                {loadingTemplates ? (
                  <div className="mt-1 px-3 py-2 text-sm text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading templates...
                  </div>
                ) : (
                  <select value={templateName}
                    onChange={(e) => {
                      const t = templates.find((t) => t.name === e.target.value)
                      setTemplateName(e.target.value)
                      setTemplateBody(t?.body || '')
                      setSelectedTemplate(t || null)
                    }}
                    className="w-full mt-1 px-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">Select an approved template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.name}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* ── Variable Mapping ── */}
              {selectedTemplate && templateVariables.length > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-3">
                    Map Template Variables to Your Columns
                  </p>
                  <div className="space-y-2">
                    {templateVariables.map((variable) => (
                      <div key={variable} className="flex items-center gap-3">
                        <span className="shrink-0 font-mono text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg min-w-[48px] text-center">
                          {variable}
                        </span>
                        <span className="text-gray-400 text-xs">→</span>
                        <select
                          value={variableMapping[variable] || ''}
                          onChange={(e) => setVariableMapping((prev) => ({ ...prev, [variable]: e.target.value }))}
                          className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-blue-200 dark:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          <option value="">Select column...</option>
                          {columns.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        {variableMapping[variable] && sampleContact[variableMapping[variable]] && (
                          <span className="shrink-0 text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg max-w-[80px] truncate">
                            e.g. {sampleContact[variableMapping[variable]]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Live preview */}
                  <div className="mt-4">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2 font-medium">Live Preview (first contact)</p>
                    <div className="bg-emerald-500 text-white text-xs p-3 rounded-xl rounded-br-sm max-w-xs leading-relaxed whitespace-pre-wrap">
                      {previewText || selectedTemplate.body}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{selectedTemplate.category}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">{selectedTemplate.language}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{templateVariables.length} variable(s)</span>
                  </div>
                </div>
              )}

              {/* Template with no variables */}
              {selectedTemplate && templateVariables.length === 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Template Preview</p>
                  <div className="bg-emerald-500 text-white text-xs p-3 rounded-xl rounded-br-sm max-w-xs leading-relaxed whitespace-pre-wrap">
                    {selectedTemplate.body}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">This template has no variables — same message sent to everyone</p>
                </div>
              )}

              {/* Header Media Upload (Only show if template expects IMAGE or DOCUMENT) */}
              {selectedTemplate && (selectedTemplate.header_format === 'IMAGE' || selectedTemplate.header_format === 'DOCUMENT') && (
                <div>
                  <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    {selectedTemplate.header_format === 'DOCUMENT' ? 'Header Document (PDF)' : 'Header Image'}
                  </label>
                  <div className="mt-1">
                    {headerImageUrl ? (
                      <div className="relative">
                        {headerImageUrl.toLowerCase().includes('.pdf') ? (
                          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                            <FileText className="w-8 h-8 text-red-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                                {headerImageUrl.split('/').pop()}
                              </p>
                              <p className="text-[10px] text-gray-400">PDF Document</p>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={headerImageUrl}
                            alt="Header"
                            className="w-full max-h-40 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setHeaderImageUrl('')}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <p className="text-[10px] text-emerald-600 mt-1">✓ File uploaded</p>
                      </div>
                    ) : (
                      <div
                        onClick={() => imageRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-400 transition-colors"
                      >
                        <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                        <p className="text-xs text-gray-500">
                          {selectedTemplate.header_format === 'DOCUMENT'
                            ? 'Click to upload header PDF'
                            : 'Click to upload header image'}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {selectedTemplate.header_format === 'DOCUMENT'
                            ? 'PDF Document'
                            : 'JPG, PNG, WEBP'}
                        </p>
                        <input
                          ref={imageRef}
                          type="file"
                          accept={
                            selectedTemplate.header_format === 'DOCUMENT'
                              ? 'application/pdf'
                              : 'image/*'
                          }
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </div>
                    )}
                    {uploadingImage && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading file...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Save as Phonebook Option */}
              <div className="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsPhonebook}
                    onChange={(e) => {
                      setSaveAsPhonebook(e.target.checked)
                      if (e.target.checked && !phonebookNameInput) {
                        setPhonebookNameInput(campaignName || `Phonebook - ${new Date().toLocaleDateString()}`)
                      }
                    }}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Save contacts as a new Phonebook</span>
                  </div>
                </label>

                {saveAsPhonebook && (
                  <div className="pt-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Phonebook Name *</label>
                    <input
                      type="text"
                      value={phonebookNameInput}
                      onChange={(e) => setPhonebookNameInput(e.target.value)}
                      placeholder="e.g. March Prospects Phonebook"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div>
                <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Schedule (optional)</label>
                <div className="flex gap-2">
                  <input 
                    type="datetime-local" 
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    value={scheduledAt} 
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="flex-1 mt-1 px-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                  />
                  {scheduledAt && (
                    <button onClick={() => setScheduledAt('')} className="mt-1 px-3 py-2 bg-red-100 text-red-600 text-sm rounded-xl hover:bg-red-200">Clear</button>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Leave empty to send immediately</p>
              </div>
            </div>

            <button onClick={() => setStep(4)} disabled={!campaignName || !templateName}
              className="mt-4 w-full py-2 bg-emerald-500 text-white text-sm rounded-xl hover:bg-emerald-600 disabled:opacity-40 font-medium">
              Preview & Send →
            </button>
          </StepCard>
        )}

        {/* Step 4: Review & Send */}
        {step >= 4 && (
          <StepCard number={4} title="Review & Send" active>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3 mb-4">
              <ReviewRow label="Campaign"   value={campaignName} />
              <ReviewRow label="Template"   value={templateName} />
              <ReviewRow label="Recipients" value={`${filteredContacts.length} contacts`} />
              <ReviewRow label="Schedule"   value={scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Send immediately'} />

              {templateVariables.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Variable Mapping</p>
                  {templateVariables.map((v) => (
                    <p key={v} className="text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">{v}</span>
                      {' → '}
                      <span className="font-medium">{variableMapping[v] || '(not mapped)'}</span>
                    </p>
                  ))}
                </div>
              )}

              {previewText && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Message Preview (first contact)</p>
                  <div className="bg-emerald-500 text-white text-xs p-3 rounded-xl rounded-br-sm max-w-xs whitespace-pre-wrap leading-relaxed">
                    {previewText}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This will send {filteredContacts.length} WhatsApp messages. Make sure your template is approved by Meta.
              </p>
            </div>

            <button onClick={handleSend} disabled={sending}
              className="w-full py-3 bg-emerald-500 text-white text-sm rounded-xl hover:bg-emerald-600 disabled:opacity-50 font-semibold flex items-center justify-center gap-2">
              {sending
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating Campaign...</>
                : <><Send className="w-4 h-4" /> {scheduledAt ? 'Schedule Campaign' : `Send to ${filteredContacts.length} Contacts`}</>
              }
            </button>
          </StepCard>
        )}
      </div>

      {/* Right: Tips */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-950 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">📋 File Format Tips</h3>
          <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <li>✅ Column named <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Phone</code> or <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">phone</code></li>
            <li>✅ Column named <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Name</code> or <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">name</code></li>
            <li>✅ Phone with country code (e.g. 919876543210)</li>
            <li>❌ No special characters in phone</li>
            <li>❌ No empty rows</li>
          </ul>
        </div>
        <div className="bg-white dark:bg-gray-950 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">📨 Variable Mapping Tips</h3>
          <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <li>✅ Map each <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{{1}}'}</code> to a column</li>
            <li>✅ Preview updates live as you map</li>
            <li>✅ Works with any number of variables</li>
            <li>✅ Different campaigns can use different mappings</li>
            <li>❌ Cannot use unapproved templates</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Campaign History ───────────────────────────────────────────
function CampaignHistory({ campaigns, onRefresh }: { campaigns: Campaign[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Record<string, any[]>>({})

  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign and all its contacts? This cannot be undone.')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {}
      const res = await fetch(`/api/campaigns/${id}`, { 
        method: 'DELETE',
        headers
      })
      if (res.ok) {
        onRefresh()
      } else {
        alert('Failed to delete campaign')
      }
    } catch (err) {
      console.error(err)
      alert('Delete failed')
    }
  }

  const loadContacts = async (id: string) => {
    if (contacts[id]) { setExpanded(expanded === id ? null : id); return }
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''
    const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {}
    const res = await fetch(`/api/campaigns/contacts?campaign_id=${id}`, { headers })
    if (res.ok) { const data = await res.json(); setContacts((prev) => ({ ...prev, [id]: data })) }
    setExpanded(id)
  }

  const exportCampaign = (campaign: Campaign) => {
    const c = contacts[campaign.id] || []
    if (!c.length) return
    const csv  = Papa.unparse(c.map((x) => ({ Phone: x.phone, Name: x.name, Status: x.status, Error: x.error || '' })))
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${campaign.name}-report.csv`; a.click()
  }

  if (!campaigns.length) {
    return (
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center">
        <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No campaigns yet</p>
        <p className="text-gray-400 text-xs mt-1">Create your first bulk campaign to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => {
        const pct          = campaign.total > 0 ? Math.round((campaign.sent / campaign.total) * 100) : 0
        const deliveryRate = campaign.sent  > 0 ? Math.round((campaign.delivered / campaign.sent) * 100) : 0
        const isExpanded   = expanded === campaign.id

        return (
          <div key={campaign.id} className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{campaign.name}</h3>
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[campaign.status]}`}>
                      {STATUS_ICONS[campaign.status]}{campaign.status}
                    </span>
                    {campaign.phonebook_name && (
                      <span className="flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        <BookOpen className="w-3 h-3" />
                        {campaign.phonebook_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Template: <span className="font-mono text-gray-600 dark:text-gray-300">{campaign.template_name}</span>
                    {' · '}
                    {campaign.status === 'draft' && campaign.scheduled_at
                      ? `Scheduled: ${new Date(campaign.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`
                      : `Sent: ${new Date(campaign.started_at || campaign.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { loadContacts(campaign.id); exportCampaign(campaign) }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" title="Export">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => loadContacts(campaign.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" title="View contacts">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCampaign(campaign.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete campaign">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Progress</span><span>{pct}% ({campaign.sent}/{campaign.total})</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-3">
                <MiniStat label="Total"     value={campaign.total}     color="text-gray-700 dark:text-gray-300" />
                <MiniStat label="Sent"      value={campaign.sent}      color="text-blue-600" />
                <MiniStat label="Delivered" value={campaign.delivered} color="text-green-600" />
                <MiniStat label="Failed"    value={campaign.failed}    color="text-red-500" />
              </div>

              {campaign.sent > 0 && (
                <p className="mt-2 text-[10px] text-gray-400">
                  Delivery rate: <span className="text-green-600 font-medium">{deliveryRate}%</span>
                </p>
              )}
            </div>

            {isExpanded && contacts[campaign.id] && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-500 font-medium">Phone</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-medium">Name</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-medium">Status</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts[campaign.id].map((c, i) => (
                        <tr key={i} className="border-t border-gray-50 dark:border-gray-900">
                          <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">{c.phone}</td>
                          <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{c.name}</td>
                          <td className="px-4 py-2">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              c.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              c.status === 'sent'      ? 'bg-blue-100 text-blue-700' :
                              c.status === 'failed'    ? 'bg-red-100 text-red-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>{c.status}</span>
                          </td>
                          <td className="px-4 py-2 text-red-400 text-[10px]">{c.error || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Helper Components ──────────────────────────────────────────
function StepCard({ number, title, active, complete, children }: {
  number: number; title: string; active: boolean; complete?: boolean; children: React.ReactNode
}) {
  return (
    <div className={`bg-white dark:bg-gray-950 rounded-2xl border p-5 transition-all ${active ? 'border-emerald-200 dark:border-emerald-900 shadow-sm' : 'border-gray-200 dark:border-gray-800 opacity-50'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${complete ? 'bg-emerald-500 text-white' : active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
          {complete ? '✓' : number}
        </div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-base font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  )
}

function PhonebooksTab() {
  const [phonebooks, setPhonebooks] = useState<any[]>([])
  const [selectedPbId, setSelectedPbId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [pbName, setPbName] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Contact creation state
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContactPhone, setNewContactPhone] = useState('')
  const [newContactName, setNewContactName] = useState('')
  const [newContactVarsText, setNewContactVarsText] = useState('')
  const [addingContact, setAddingContact] = useState(false)

  // CSV upload state inside phonebook details
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchPhonebooks = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      const res = await fetch('/api/phonebooks', { headers })
      if (res.ok) {
        setPhonebooks(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPhonebooks()
  }, [fetchPhonebooks])

  const handleCreatePb = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pbName.trim()) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      }
      const res = await fetch('/api/phonebooks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: pbName })
      })
      if (res.ok) {
        setPbName('')
        fetchPhonebooks()
      } else {
        alert('Failed to create phonebook')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeletePb = async (id: string) => {
    if (!confirm('Are you sure you want to delete this phonebook and all its contacts?')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      const res = await fetch(`/api/phonebooks?id=${id}`, {
        method: 'DELETE',
        headers
      })
      if (res.ok) {
        if (selectedPbId === id) setSelectedPbId(null)
        fetchPhonebooks()
      } else {
        alert('Failed to delete phonebook')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSelectPb = async (id: string) => {
    setSelectedPbId(id)
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      const res = await fetch(`/api/phonebooks/${id}/contacts`, { headers })
      if (res.ok) {
        setContacts(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContactPhone || !selectedPbId) return
    setAddingContact(true)
    try {
      let vars = {}
      if (newContactVarsText.trim()) {
        try {
          vars = JSON.parse(newContactVarsText)
        } catch (err) {
          alert('Custom variables must be a valid JSON object.')
          setAddingContact(false)
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      }
      const res = await fetch(`/api/phonebooks/${selectedPbId}/contacts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contacts: [{
            phone: newContactPhone,
            name: newContactName,
            variables: vars
          }]
        })
      })

      if (res.ok) {
        setNewContactPhone('')
        setNewContactName('')
        setNewContactVarsText('')
        setShowAddContact(false)
        handleSelectPb(selectedPbId)
        fetchPhonebooks()
      } else {
        const d = await res.json()
        alert(`Failed to add contact: ${d.error || 'Unknown error'}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAddingContact(false)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Delete this contact?')) return
    if (!selectedPbId) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      const res = await fetch(`/api/phonebooks/${selectedPbId}/contacts?contactId=${contactId}`, {
        method: 'DELETE',
        headers
      })
      if (res.ok) {
        handleSelectPb(selectedPbId)
        fetchPhonebooks()
      } else {
        alert('Failed to delete contact')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedPbId) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[]
        if (rows.length === 0) {
          alert('CSV file is empty.')
          return
        }

        const cols = Object.keys(rows[0])
        const phoneKey = findPhoneKey(cols)
        const nameKey = findNameKey(cols, phoneKey)

        const contactsList = rows.map((row) => {
          const variables: Record<string, string> = {}
          cols.forEach((col) => {
            if (col !== phoneKey && col !== nameKey) {
              variables[col] = String(row[col] || '').trim()
            }
          })

          return {
            phone: cleanPhoneNumber(row[phoneKey]),
            name: String(row[nameKey] || '').trim(),
            variables
          }
        }).filter(c => c.phone.length >= 10)

        if (contactsList.length === 0) {
          alert('No valid contacts (phone numbers) found in the file.')
          return
        }

        setLoading(true)
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
          }
          const res = await fetch(`/api/phonebooks/${selectedPbId}/contacts`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ contacts: contactsList })
          })

          if (res.ok) {
            handleSelectPb(selectedPbId)
            fetchPhonebooks()
          } else {
            const d = await res.json()
            alert(`Failed to import contacts: ${d.error || 'Unknown error'}`)
          }
        } catch (err) {
          console.error(err)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const activePb = phonebooks.find(p => p.id === selectedPbId)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left panel: phonebooks list */}
      <div className="md:col-span-1 bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">Your Phonebooks</h3>
        
        <form onSubmit={handleCreatePb} className="flex gap-2">
          <input
            type="text"
            placeholder="New phonebook name..."
            value={pbName}
            onChange={(e) => setPbName(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-xl bg-gray-150 dark:bg-gray-800 text-gray-800 dark:text-gray-250 focus:outline-none border border-transparent focus:border-gray-250 focus:ring-1 focus:ring-emerald-500 focus:ring-opacity-50"
          />
          <button
            type="submit"
            disabled={!pbName.trim()}
            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {phonebooks.map((pb) => (
            <div
              key={pb.id}
              onClick={() => handleSelectPb(pb.id)}
              className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer ${
                selectedPbId === pb.id
                  ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : 'border-gray-100 dark:border-gray-850 hover:bg-gray-50 dark:hover:bg-gray-900'
              }`}
            >
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">{pb.name}</p>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{pb.contact_count} contacts</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeletePb(pb.id)
                }}
                className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {phonebooks.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">No phonebooks created yet.</p>
          )}
        </div>
      </div>

      {/* Right panel: phonebook contacts details */}
      <div className="md:col-span-2 bg-white dark:bg-gray-955 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col min-h-[50vh]">
        {activePb ? (
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">{activePb.name}</h3>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{contacts.length} total contacts</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddContact(!showAddContact)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-250 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Contact
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Import CSV
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvUpload}
                />
              </div>
            </div>

            {showAddContact && (
              <form onSubmit={handleAddContact} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-850 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      placeholder="e.g. 919876543210"
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none border border-gray-200 dark:border-gray-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
                    <input
                      type="text"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none border border-gray-200 dark:border-gray-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Custom Variables (JSON Format)</label>
                  <input
                    type="text"
                    value={newContactVarsText}
                    onChange={(e) => setNewContactVarsText(e.target.value)}
                    placeholder='e.g. {"city": "Mumbai", "company": "Acme"}'
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none border border-gray-200 dark:border-gray-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddContact(false)}
                    className="px-3 py-1.5 border border-gray-250 dark:border-gray-800 text-gray-500 text-xs font-bold rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingContact || !newContactPhone}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center cursor-pointer"
                  >
                    {addingContact ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex-1 rounded-xl border border-gray-150 dark:border-gray-850 overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-155 dark:border-gray-850">
                  <tr>
                    <th className="px-4 py-3 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Name</th>
                    <th className="px-4 py-3 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Phone</th>
                    <th className="px-4 py-3 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Variables</th>
                    <th className="px-4 py-3 text-gray-500 text-right font-bold uppercase tracking-wider text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{contact.name || '--'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">{contact.phone}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {contact.variables && Object.keys(contact.variables).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(contact.variables).map(([k, v]) => (
                              <span key={k} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-605 dark:text-gray-400 border border-gray-150 dark:border-gray-700/50 font-bold text-[9px]">{k}: {String(v)}</span>
                            ))}
                          </div>
                        ) : '--'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-gray-400 py-12">No contacts in this phonebook. Click "Import CSV" or "Add Contact" above to start.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center select-none py-12">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
            <h4 className="text-sm font-extrabold text-gray-700 dark:text-gray-300 tracking-tight">No Phonebook Selected</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">Choose a phonebook from the left panel or create a new one to manage your saved contacts.</p>
          </div>
        )}
      </div>
    </div>
  )
}
