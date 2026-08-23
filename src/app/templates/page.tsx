'use client'

import { useState, useEffect, useMemo } from 'react'
import Sidebar from '@/components/Sidebar'
import CreateTemplateModal from '@/components/chat/CreateTemplateModal'
import { supabase } from '@/lib/supabaseClient'
import { 
  Sparkles, Search, Plus, Loader2, AlertCircle, FileText, CheckCircle2, 
  Clock, Eye, MessageSquare, Tag, Globe, RefreshCw, Send
} from 'lucide-react'

interface Template {
  id: string
  name: string
  language: string
  status: string
  category: string
  body: string
  header?: string
  header_format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | null
  footer?: string
  variables?: string[]
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  const fetchTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to load templates')
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setTemplates(data)
        if (data.length > 0 && !previewTemplate) {
          setPreviewTemplate(data[0])
        }
      }
    } catch (err: any) {
      console.error('Fetch templates error:', err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch = 
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase()) ||
        t.body.toLowerCase().includes(search.toLowerCase())
      
      const matchesCategory = selectedCategory === 'ALL' || t.category.toUpperCase() === selectedCategory
      const matchesStatus = selectedStatus === 'ALL' || t.status.toUpperCase() === selectedStatus

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [templates, search, selectedCategory, selectedStatus])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* Top Banner Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-5 h-5" />
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Meta WhatsApp Templates Hub</h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                Design, submit, and manage official Meta-approved WhatsApp message templates directly inside your Vox AI dashboard.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={fetchTemplates}
                disabled={loading}
                className="p-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60 rounded-2xl transition-all shadow-md active:scale-95"
                title="Refresh Templates"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Meta Template</span>
              </button>
            </div>
          </div>

          {/* Filter & Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search templates by name, body text, or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold text-slate-400">
                <span className="px-2.5 py-1 text-slate-500 uppercase text-[10px]">Category:</span>
                {['ALL', 'MARKETING', 'UTILITY', 'AUTHENTICATION'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      selectedCategory === cat
                        ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                        : 'hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold text-slate-400">
                <span className="px-2.5 py-1 text-slate-500 uppercase text-[10px]">Status:</span>
                {['ALL', 'APPROVED', 'PENDING'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatus(st)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      selectedStatus === st
                        ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                        : 'hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Templates Grid & Live WhatsApp Preview Drawer */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-3xl gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span className="text-sm font-semibold">Loading official Meta WhatsApp templates...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center gap-3 text-sm text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <h4 className="font-bold text-base">Error Loading Templates</h4>
                <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-3xl text-center space-y-3">
              <div className="p-4 rounded-full bg-slate-800/60 text-slate-400">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white">No Meta Templates Found</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                No templates matched your search filters. Click below to design and submit a new Meta template!
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Meta Template</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Template Cards List (8 cols) */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => {
                  const isSelected = previewTemplate?.id === template.id
                  return (
                    <div
                      key={template.id}
                      onClick={() => setPreviewTemplate(template)}
                      className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                        isSelected
                          ? 'bg-emerald-950/20 border-emerald-500/60 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/40'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-sm text-white truncate font-mono">{template.name}</h3>
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full border shrink-0 flex items-center gap-1 ${
                            template.status.toUpperCase() === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {template.status.toUpperCase() === 'APPROVED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            <span>{template.status}</span>
                          </span>
                        </div>

                        {/* Category & Language Pills */}
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold uppercase">
                            {template.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 text-[10px] font-mono">
                            {template.language}
                          </span>
                          {template.header_format && template.header_format !== 'TEXT' && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase">
                              {template.header_format}
                            </span>
                          )}
                        </div>

                        {/* Body Snippet */}
                        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed pt-1">
                          {template.body}
                        </p>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                        <span>{template.variables?.length || 0} variables</span>
                        <span className="text-emerald-400 font-bold group-hover:underline flex items-center gap-1">
                          <span>Preview Card</span>
                          <Eye className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Live WhatsApp Card Preview Column (5 cols) */}
              <div className="lg:col-span-5 bg-[#0b141a] p-6 rounded-3xl border border-slate-800 flex flex-col justify-between sticky top-6 max-h-[82vh] overflow-y-auto">
                {previewTemplate ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <h4 className="font-bold text-sm text-white font-mono">{previewTemplate.name}</h4>
                        <span className="text-xs text-slate-400">WhatsApp Green Bubble Preview</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {previewTemplate.category}
                      </span>
                    </div>

                    {/* WhatsApp Green Card */}
                    <div className="bg-[#005c4b] text-white rounded-2xl rounded-tr-none p-4 shadow-2xl space-y-2 border border-emerald-600/40">
                      {previewTemplate.header && (
                        <h5 className="font-bold text-sm text-emerald-100">{previewTemplate.header}</h5>
                      )}

                      {previewTemplate.header_format && previewTemplate.header_format !== 'TEXT' && (
                        <div className="w-full h-36 bg-slate-900/80 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5 border border-emerald-500/30">
                          <FileText className="w-7 h-7 text-emerald-400" />
                          <span className="font-bold">[{previewTemplate.header_format} HEADER ATTACHMENT]</span>
                        </div>
                      )}

                      <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-100">
                        {previewTemplate.body}
                      </p>

                      {previewTemplate.footer && (
                        <p className="text-[10px] text-emerald-200/80 pt-1 border-t border-emerald-500/30">
                          {previewTemplate.footer}
                        </p>
                      )}

                      <div className="text-[9px] text-emerald-200/60 text-right">
                        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Approval Status:</span>
                        <span className="font-bold text-emerald-400 uppercase">{previewTemplate.status}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Language Code:</span>
                        <span className="font-mono text-white">{previewTemplate.language}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Template ID:</span>
                        <span className="font-mono text-slate-300 text-[10px]">{previewTemplate.id}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-xs">
                    Select a template to view live preview
                  </div>
                )}
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Standalone Create Meta Template Modal */}
      <CreateTemplateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(createdName) => {
          fetchTemplates()
        }}
      />
    </div>
  )
}
