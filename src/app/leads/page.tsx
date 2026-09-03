'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Search, 
  Filter, 
  Download, 
  MessageSquare, 
  Tag, 
  Eye, 
  X, 
  TrendingUp, 
  Calendar, 
  Phone, 
  User, 
  Check, 
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { useOrg } from '@/contexts/OrgContext'
import { useRouter } from 'next/navigation'

interface Lead {
  id: string
  conversation_id: string
  phone_number: string
  name: string | null
  stage: string
  lead_quality: string | null
  lead_temperature?: string | null
  lead_score: number
  industry?: string | null
  followup_date?: string | null
  followup_notes?: string | null
  created_at: string
  metadata: Record<string, any>
}

const STAGES = [
  'new',
  'interested',
  'booking',
  'confirmed',
  'completed',
  'cancelled',
  'followup',
  'not_interested',
  'call_done',
  'low_budget',
  'hot_customer'
]

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  interested: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  booking: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  followup: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  not_interested: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  call_done: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  low_budget: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  hot_customer: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
}

const QUALITY_COLORS: Record<string, string> = {
  hot: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 font-bold',
  HOT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 font-bold',
  warm: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 font-bold',
  WARM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 font-bold',
  cold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  COLD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  suppressed: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400 border border-rose-400',
  SUPPRESSED: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400 border border-rose-400',
  unknown: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

export const dynamic = 'force-dynamic'

export default function LeadsPage() {
  const { profile, loading: authLoading } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login')
  }, [profile, authLoading, router])

  if (authLoading || !profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <LeadsContent />
}

function LeadsContent() {
  const { org } = useOrg()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [search, setSearch] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedQuality, setSelectedQuality] = useState('')
  
  // Selected Lead for Details Drawer
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  
  // Edit State inside Drawer
  const [editStage, setEditStage] = useState('')
  const [editQuality, setEditQuality] = useState('')
  const [editScore, setEditScore] = useState(0)
  const [savingLead, setSavingLead] = useState(false)

  useEffect(() => {
    fetchLeads()
  }, [selectedStage, selectedQuality])

  const fetchLeads = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const headers = { 'Authorization': `Bearer ${token}` }

      const params = new URLSearchParams()
      if (selectedStage) params.set('stage', selectedStage)
      if (selectedQuality) params.set('quality', selectedQuality)
      if (search) params.set('search', search)

      const res = await fetch(`/api/leads/list?${params}`, { headers, cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch leads list')
      const data = await res.json()
      setLeads(data)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An error occurred while loading leads.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchLeads()
    }
  }

  // Save Lead changes (Stage / Quality / Score)
  const handleUpdateLead = async () => {
    if (!activeLead) return
    setSavingLead(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      const updates = {
        conversation_id: activeLead.conversation_id,
        stage: editStage,
        lead_quality: editQuality || null,
        lead_score: editScore
      }

      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      })

      if (!res.ok) throw new Error('Failed to update lead')
      
      const updatedData = await res.json()
      
      // Update local state list
      setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, ...updates } : l))
      setActiveLead(prev => prev ? { ...prev, ...updates } : null)
      
      // Show success micro-animation feedback
    } catch (err) {
      console.error(err)
      alert('Failed to update lead settings.')
    } finally {
      setSavingLead(false)
    }
  }

  // Open Details Drawer
  const handleViewLead = (lead: Lead) => {
    let meta = (lead.metadata || {}) as Record<string, any>;
    if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch (e) { meta = {} } }
    const score = Number(meta.lead_score ?? lead.lead_score) || 0;
    const stage = meta.state || meta.stage || lead.stage || 'new';
    const quality = meta.lead_quality || (score >= 70 ? 'hot' : score >= 40 ? 'warm' : score > 0 ? 'cold' : lead.lead_quality || 'unknown');
    
    setActiveLead({ ...lead, metadata: meta })
    setEditStage(stage)
    setEditQuality(quality)
    setEditScore(score)
  }

  // Download filtered leads as CSV
  const handleDownloadCSV = () => {
    if (leads.length === 0) return

    // Standard columns
    const standardHeaders = ['Name', 'Phone', 'Stage', 'Lead Quality', 'Lead Score', 'Created At']

    // Unique keys in metadata
    const metadataKeys = new Set<string>()
    leads.forEach(l => {
      let meta = l.metadata || {};
      if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch (e) {} }
      if (meta) {
        Object.keys(meta).forEach(k => metadataKeys.add(k))
      }
    })

    const allHeaders = [...standardHeaders, ...Array.from(metadataKeys)]
    const csvRows = []

    // Header row
    csvRows.push(allHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(','))

    // Data rows
    leads.forEach(l => {
      let meta = l.metadata || {};
      if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch (e) {} }
      const score = Number(meta.lead_score ?? l.lead_score) || 0;
      const quality = meta.lead_quality || (score >= 70 ? 'hot' : score >= 40 ? 'warm' : score > 0 ? 'cold' : l.lead_quality || 'unknown');
      const stage = meta.state || meta.stage || l.stage || 'new';

      const row = [
        l.name || (l as any).customer_name || meta.name || meta.contact_person || 'Unknown',
        l.phone_number || '',
        stage,
        quality,
        String(score),
        l.created_at ? new Date(l.created_at).toLocaleString() : ''
      ]

      metadataKeys.forEach(k => {
        row.push(meta?.[k] || '')
      })

      csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    })

    const csvContent = csvRows.join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `leads_crm_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Lead Counts (reads score/temperature dynamically from metadata first)
  const totalLeads = leads.length
  const hotLeads = leads.filter(l => {
    let meta = l.metadata || {};
    if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch (e) {} }
    const score = Number(meta.lead_score ?? l.lead_score) || 0;
    const temp = (meta.lead_temperature || meta.lead_quality || (score >= 70 ? 'hot' : score >= 40 ? 'warm' : l.lead_temperature || l.lead_quality || '')).toLowerCase();
    return score >= 70 || temp === 'hot';
  }).length

  const warmLeads = leads.filter(l => {
    let meta = l.metadata || {};
    if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch (e) {} }
    const score = Number(meta.lead_score ?? l.lead_score) || 0;
    const temp = (meta.lead_temperature || meta.lead_quality || (score >= 70 ? 'hot' : score >= 40 ? 'warm' : l.lead_temperature || l.lead_quality || '')).toLowerCase();
    return (score >= 40 && score < 70) || temp === 'warm';
  }).length

  const followupLeads = leads.filter(l => l.stage === 'followup' || !!l.followup_date).length

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden text-gray-900 dark:text-gray-100">
      
      {/* Header Banner */}
      <header className="h-14 bg-emerald-600 dark:bg-emerald-800 shrink-0 flex items-center justify-between px-6 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <Sidebar />
          <span className="text-white font-semibold text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 opacity-90" />
            Lead CRM Portal
          </span>
          <span className="text-xs text-emerald-200 border border-emerald-500 rounded px-2 py-0.5 ml-2 font-mono">
            {org?.name || 'Tenant System'}
          </span>
        </div>

        <button
          onClick={handleDownloadCSV}
          disabled={leads.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg shadow transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative z-0">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total CRM Leads" value={totalLeads} color="border-l-blue-500 text-blue-600" />
            <MetricCard label="Hot Status Leads" value={hotLeads} color="border-l-red-500 text-red-600" />
            <MetricCard label="Warm Status Leads" value={warmLeads} color="border-l-orange-500 text-orange-600" />
            <MetricCard label="Active Follow-ups" value={followupLeads} color="border-l-cyan-500 text-cyan-600" />
          </div>

          {/* Filtering Controls */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Search leads, crop, tehsil, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyPress}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              {/* Stage Filter */}
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-3 py-1.5 rounded-lg w-1/2 md:w-auto">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="bg-transparent text-xs text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer w-full"
                >
                  <option value="">All Stages</option>
                  {STAGES.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Quality Filter */}
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-3 py-1.5 rounded-lg w-1/2 md:w-auto">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={selectedQuality}
                  onChange={(e) => setSelectedQuality(e.target.value)}
                  className="bg-transparent text-xs text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer w-full"
                >
                  <option value="">All Qualities</option>
                  <option value="hot">HOT</option>
                  <option value="warm">WARM</option>
                  <option value="cold">COLD</option>
                </select>
              </div>

              <button
                onClick={fetchLeads}
                className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-lg transition-colors border border-emerald-200 dark:border-emerald-900/50"
              >
                Apply
              </button>
            </div>
          </div>

          {/* CRM Leads Table */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[350px]">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">Loading leads from CRM database...</p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-red-500">
                <AlertCircle className="w-10 h-10 mb-2" />
                <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">{error}</p>
                <button onClick={fetchLeads} className="mt-3 px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors border border-red-200">
                  Try Again
                </button>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mb-2" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">No Leads Found</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">Adjust your search parameters or check your n8n workflow connections.</p>
              </div>
            ) : (() => {
              const skipKeys = [
                'id', 'created_at', 'updated_at', 'org_id', 'assigned_to', 
                'phone_number', 'name', 'conversation_id',
                'followup_notes', 'followup_date', 'followup_notified',
                'metadata', 'lead_type'
              ];

              const priorityOrder = [
                'lead_score', 'lead_quality', 'state', 'industry', 'business_intent', 
                'business_type', 'business_name', 'contact_person', 'city', 'email', 
                'demo_selected', 'pricing_requested', 'consultation_ready'
              ];

              // Always include core standard CRM keys so columns never disappear
              const standardKeys = [
                'lead_score', 'lead_quality', 'state', 'industry', 'business_intent'
              ];

              // Collect all unique custom keys across leads (merging top-level and metadata)
              const rawKeys = Array.from(new Set([
                ...standardKeys,
                ...leads.flatMap(lead => {
                  let meta = (lead.metadata || {}) as Record<string, any>;
                  if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta) } catch (e) { meta = {} }
                  }
                  const combined = { ...lead, ...meta } as Record<string, any>;
                  return Object.keys(combined).filter(key => {
                    if (skipKeys.includes(key.toLowerCase())) return false;
                    const val = combined[key];
                    if (typeof val === 'object' || val === null || val === undefined || String(val).trim() === '') return false;
                    return true;
                  });
                })
              ]));

              // Sort keys so high-priority CRM fields (Score, Quality, State, Industry) appear first
              const uniqueCustomKeys = rawKeys.sort((a, b) => {
                const idxA = priorityOrder.indexOf(a.toLowerCase());
                const idxB = priorityOrder.indexOf(b.toLowerCase());
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
              });

              return (
                <div className="overflow-x-auto flex-1 pb-4">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-950 text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider text-left uppercase sticky top-0 z-20">
                      <tr>
                        <th className="px-6 py-3 whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-gray-950 z-30 shadow-[inset_-1px_0_0_0_#e5e7eb] dark:shadow-[inset_-1px_0_0_0_#1f2937]">Lead Contact</th>
                        {uniqueCustomKeys.map(key => (
                          <th key={key} className="px-6 py-3 whitespace-nowrap">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </th>
                        ))}
                        <th className="px-6 py-3 whitespace-nowrap">Date Added</th>
                        <th className="px-6 py-3 text-right whitespace-nowrap sticky right-0 bg-gray-50 dark:bg-gray-950 z-30 shadow-[inset_1px_0_0_0_#e5e7eb] dark:shadow-[inset_1px_0_0_0_#1f2937]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                      {leads.map((lead) => {
                        let rawFollowup = lead.followup_notes || '';
                        if (rawFollowup.includes('Scheduled Meeting')) {
                          rawFollowup = 'Scheduled Meeting';
                        }

                        let meta = (lead.metadata || {}) as Record<string, any>;
                        if (typeof meta === 'string') {
                          try { meta = JSON.parse(meta) } catch (e) { meta = {} }
                        }

                        // Merge lead with metadata so metadata overrides stale columns
                        const allCustomData = { ...lead, ...meta } as Record<string, any>;

                        // Dynamically derive quality/temperature from score if available
                        const metaScore = Number(allCustomData.lead_score) || 0;
                        if (metaScore >= 70) {
                          allCustomData.lead_temperature = 'HOT';
                          allCustomData.lead_quality = 'HOT';
                        } else if (metaScore >= 40) {
                          allCustomData.lead_temperature = 'WARM';
                          allCustomData.lead_quality = 'WARM';
                        } else if (metaScore > 0) {
                          allCustomData.lead_temperature = 'COLD';
                          allCustomData.lead_quality = 'COLD';
                        }

                        const displayName = lead.name || (lead as any).customer_name || allCustomData.Name || allCustomData.name || allCustomData.contact_person || allCustomData.customer_name || 'Unknown';

                        return (
                          <tr 
                            key={lead.id} 
                            className="group hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
                            onClick={() => handleViewLead(lead)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/50 transition-colors z-10 shadow-[inset_-1px_0_0_0_#f3f4f6] dark:shadow-[inset_-1px_0_0_0_#1f2937]">
                              <div className="font-semibold text-gray-950 dark:text-white">{displayName}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {lead.phone_number}
                              </div>
                              {rawFollowup && <div className="text-cyan-600 dark:text-cyan-400 text-[10px] truncate font-medium mt-1">📌 {rawFollowup}</div>}
                            </td>

                            {uniqueCustomKeys.map(key => {
                              const val = allCustomData[key];
                              const displayVal = val !== undefined && val !== null ? String(val) : '-';
                              const truncatedVal = displayVal.length > 50 ? displayVal.substring(0, 50) + '...' : displayVal;
                              
                              if (key.toLowerCase() === 'lead_score') {
                                 const score = Number(val ?? allCustomData.lead_score) || 0;
                                 return (
                                   <td key={key} className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                          <div 
                                            className={`h-1.5 rounded-full ${score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-amber-500' : 'bg-blue-500'}`} 
                                            style={{ width: `${Math.min(100, Math.max(0, score))}%` }} 
                                          />
                                        </div>
                                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                                          score >= 70 ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300' : 
                                          score >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' : 
                                          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                        }`}>
                                          {score}
                                        </span>
                                      </div>
                                   </td>
                                 )
                              }
                              if (key.toLowerCase() === 'lead_quality' || key.toLowerCase() === 'lead_temperature') {
                                const qVal = String(val || allCustomData.lead_quality || allCustomData.lead_temperature || (metaScore >= 70 ? 'HOT' : metaScore >= 40 ? 'WARM' : 'COLD')).toUpperCase();
                                return (
                                   <td key={key} className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${QUALITY_COLORS[qVal] || 'bg-gray-100 text-gray-600'}`}>
                                        {qVal}
                                      </span>
                                   </td>
                                )
                              }
                              if (key.toLowerCase() === 'stage' || key.toLowerCase() === 'state') {
                                const sVal = String(val || allCustomData.state || allCustomData.stage || 'new').toLowerCase();
                                return (
                                   <td key={key} className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STAGE_COLORS[sVal] || 'bg-gray-100 text-gray-700'}`}>
                                        {sVal.replace(/_/g, ' ')}
                                      </span>
                                   </td>
                                )
                              }

                              return (
                                <td key={key} className="px-6 py-4 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
                                  {truncatedVal !== '-' ? (
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      {truncatedVal}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 dark:text-gray-700">-</span>
                                  )}
                                </td>
                              )
                            })}
                            
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(lead.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs sticky right-0 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-900/50 transition-colors z-10 shadow-[inset_1px_0_0_0_#f3f4f6] dark:shadow-[inset_1px_0_0_0_#1f2937]" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleViewLead(lead)}
                                className="px-2.5 py-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 rounded border border-emerald-200 dark:border-emerald-900/50 font-semibold"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

        </div>

        {/* Lead details Drawer (Opens on Right side) */}
        {activeLead && (
          <div className="absolute inset-0 bg-black/40 z-30 flex justify-end transition-opacity duration-300">
            {/* Click outside to close */}
            <div className="flex-1" onClick={() => setActiveLead(null)} />
            
            <div className="w-full max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800 animate-slide-in overflow-hidden">
              
              {/* Drawer Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                    <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">Lead Summary</span>
                </div>
                <button 
                  onClick={() => setActiveLead(null)}
                  className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Details Section */}
                <div className="space-y-3">
                  <div className="text-center pb-4 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-950 dark:text-white">{activeLead.name || 'Unknown'}</h3>
                    <p className="text-sm text-gray-500 flex items-center justify-center gap-1.5 mt-1 font-mono">
                      <Phone className="w-3.5 h-3.5" />
                      {activeLead.phone_number}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200/60 dark:border-gray-800/60">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Database ID</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300 font-mono truncate mt-0.5">{activeLead.id}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200/60 dark:border-gray-800/60">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Created Date</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                        {new Date(activeLead.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Edit Section */}
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-inner">
                  <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">CRM Management</h4>

                  <div className="space-y-3">
                    {/* Stage selector */}
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Lead Stage</label>
                      <select
                        value={editStage}
                        onChange={(e) => setEditStage(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg text-sm focus:outline-none"
                      >
                        {STAGES.map(s => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quality selector */}
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Lead Quality</label>
                      <select
                        value={editQuality}
                        onChange={(e) => setEditQuality(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg text-sm focus:outline-none"
                      >
                        <option value="unknown">UNKNOWN</option>
                        <option value="hot">HOT</option>
                        <option value="warm">WARM</option>
                        <option value="cold">COLD</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateLead}
                    disabled={savingLead}
                    className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-50"
                  >
                    {savingLead ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Save Changes
                  </button>
                </div>

                {/* Metadata JSON Viewer */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Dynamic Fields (Metadata)</h4>
                  
                  {Object.keys(activeLead.metadata || {}).length === 0 ? (
                    <p className="text-xs text-gray-500 italic p-3 bg-gray-50 dark:bg-gray-950 rounded-xl text-center border border-dashed">
                      No custom fields found.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {Object.entries(activeLead.metadata || {}).map(([key, val]) => {
                        const formattedLabel = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                        return (
                          <div 
                            key={key} 
                            className="p-3 bg-white dark:bg-gray-950 rounded-xl border border-gray-200/70 dark:border-gray-800/70 shadow-sm flex items-center justify-between"
                          >
                            <div>
                              <span className="text-[10px] text-gray-400 block font-semibold">{formattedLabel}</span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                {String(val) || <span className="text-gray-400 italic">empty</span>}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex gap-2 shrink-0">
                <Link
                  href={`/dashboard?phone=${activeLead.phone_number}`}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  Open Conversation Chat
                </Link>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`p-4 bg-white dark:bg-gray-900 rounded-xl border-l-4 ${color} border border-gray-200 dark:border-gray-800 shadow-sm`}>
      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">{label}</span>
      <span className="text-2xl font-black mt-1 block">{value}</span>
    </div>
  )
}
