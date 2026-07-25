'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from '@/components/Sidebar'
import { useOrg } from '@/contexts/OrgContext'
import { useRouter } from 'next/navigation'
import { 
  Mail, CheckCircle2, AlertCircle, RefreshCw, Loader2, ArrowRight, 
  Trash2, X, Search, Clock, Send, ChevronRight, Inbox, Eye, CornerUpLeft, 
  Save, Check, AlertTriangle
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import FeatureUpgradePaywall from '@/components/FeatureUpgradePaywall'

export const dynamic = 'force-dynamic'

interface EmailTicket {
  id: string
  org_id: string
  message_id: string
  from_email: string
  from_name: string | null
  to_email: string
  subject: string
  body_text: string
  ai_draft_reply: string | null
  status: 'pending_approval' | 'approved' | 'sent' | 'ignored'
  created_at: string
  updated_at: string
}

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  sent: 'Replied & Sent',
  ignored: 'Ignored'
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: '#f59e0b', // Amber
  approved: '#3b82f6',         // Blue
  sent: '#10b981',             // Emerald
  ignored: '#9ca3af'           // Gray
}

export default function EmailsPage() {
  const { profile, org, loading: authLoading } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login')
  }, [profile, authLoading, router])

  if (authLoading || !profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-955">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50/50 dark:bg-gray-955">
      {/* Top Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 shrink-0 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Sidebar />
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-500 shrink-0" />
            <h1 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              Email AI Agent
            </h1>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 overflow-hidden p-6">
        {org?.has_emails_crm ? (
          <EmailsInboxContent />
        ) : (
          <FeatureUpgradePaywall featureName="Email AI Agent" orgName={org?.name || 'Your Team'} />
        )}
      </div>
    </div>
  )
}

function EmailsInboxContent() {
  const [emails, setEmails] = useState<EmailTicket[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Edit draft state
  const [draftText, setDraftText] = useState('')
  const [isEditingDraft, setIsEditingDraft] = useState(false)

  // Loading/busy states
  const [actionLoading, setActionLoading] = useState(false)
  const [reGenLoading, setReGenLoading] = useState(false)

  // Fetch all email tickets
  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/emails', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to load email inbox')
      const data = await res.json()
      setEmails(data)

      // Sync selection if already selected
      if (selectedEmail) {
        const updated = data.find((e: EmailTicket) => e.id === selectedEmail.id)
        if (updated) {
          setSelectedEmail(updated)
          setDraftText(updated.ai_draft_reply || '')
        }
      }
    } catch (err) {
      console.error('Fetch emails error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedEmail])

  useEffect(() => {
    fetchEmails()
  }, [])

  // Select email ticket
  const handleSelectEmail = (ticket: EmailTicket) => {
    setSelectedEmail(ticket)
    setDraftText(ticket.ai_draft_reply || '')
    setIsEditingDraft(false)
  }

  // Update Status directly (Save Draft, Ignore, Send)
  const handleAction = async (ticketId: string, actionType: 'save' | 'sent' | 'ignored') => {
    try {
      setActionLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(`/api/emails/${ticketId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: actionType,
          ai_draft_reply: draftText
        })
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Action failed')
      }

      const updated = await res.json()
      
      // Update local state list
      setEmails(prev => prev.map(e => e.id === ticketId ? updated : e))
      setSelectedEmail(updated)
      setDraftText(updated.ai_draft_reply || '')
      setIsEditingDraft(false)

      if (actionType === 'sent') {
        alert('Email reply successfully sent to customer!')
      }
    } catch (err: any) {
      alert(`Error updating ticket: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Re-generate draft using Gemini API
  const handleReGenerateDraft = async (ticketId: string) => {
    try {
      setReGenLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      // Fetch org details to ensure clean name metadata in request
      const res = await fetch(`/api/emails/${ticketId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          // Triggers re-generation by clearing draft and setting status back
          ai_draft_reply: null,
          status: 'pending_approval'
        })
      })

      if (!res.ok) throw new Error('Re-generation request failed')

      // Wait 1.5 seconds, then refresh list
      setTimeout(async () => {
        const refreshRes = await fetch('/api/emails', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (refreshRes.ok) {
          const freshData = await refreshRes.json()
          setEmails(freshData)
          const updated = freshData.find((e: EmailTicket) => e.id === ticketId)
          if (updated) {
            setSelectedEmail(updated)
            setDraftText(updated.ai_draft_reply || '')
          }
        }
        setReGenLoading(false)
      }, 1500)
    } catch (err: any) {
      alert(`Re-generation failed: ${err.message}`)
      setReGenLoading(false)
    }
  }

  // Delete ticket
  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to permanently delete this email ticket?')) return
    try {
      setActionLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(`/api/emails/${ticketId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('Failed to delete ticket')

      setEmails(prev => prev.filter(e => e.id !== ticketId))
      setSelectedEmail(null)
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Filtering & searching
  const filteredEmails = emails.filter(e => {
    const query = search.toLowerCase()
    const matchesSearch = 
      e.subject.toLowerCase().includes(query) ||
      e.from_email.toLowerCase().includes(query) ||
      (e.from_name && e.from_name.toLowerCase().includes(query))
    
    const matchesFilter = statusFilter === 'all' || e.status === statusFilter
    return matchesSearch && matchesFilter
  })

  // Count aggregates
  const pendingCount = emails.filter(e => e.status === 'pending_approval').length
  const sentCount = emails.filter(e => e.status === 'sent').length
  const totalCount = emails.length

  return (
    <div className="h-full flex flex-col gap-6">
      
      {/* Top Banner with statistics */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <span className="text-[10px] font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100/20">
            Inbox Automation Workflow
          </span>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-2">
            AI Email Agent Tickets
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Review incoming customer inquiries, inspect AI draft replies, and approve outgoing emails.
          </p>
        </div>

        {/* Small stats badges */}
        <div className="flex gap-3">
          {[
            { label: 'Total Tickets', count: totalCount, bg: 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800' },
            { label: 'Pending Approval', count: pendingCount, bg: 'bg-amber-500/10 border-amber-500/20 text-amber-500' },
            { label: 'Replied & Sent', count: sentCount, bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' }
          ].map((it, idx) => (
            <div key={idx} className={`px-4 py-2.5 rounded-2xl border text-center min-w-[100px] ${it.bg}`}>
              <span className="text-[9px] font-extrabold uppercase tracking-wider block opacity-75">{it.label}</span>
              <span className="text-sm font-black tracking-tight mt-0.5 block">{loading ? '—' : it.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid containing master list and detailed reader panel */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Inbox list (cols 4) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl overflow-hidden flex flex-col shadow-sm">
          {/* Header search & filter controls */}
          <div className="p-4 border-b border-gray-150 dark:border-gray-800 space-y-3 bg-gray-50/30 dark:bg-gray-955/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search subject or sender..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-955 text-gray-900 dark:text-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
            
            <div className="flex gap-1.5">
              {[
                { val: 'all', lbl: 'All' },
                { val: 'pending_approval', lbl: 'Pending' },
                { val: 'sent', lbl: 'Sent' },
                { val: 'ignored', lbl: 'Ignored' }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setStatusFilter(opt.val)}
                  className={`flex-1 py-1 px-2 text-[10px] font-extrabold uppercase rounded-lg border transition-all cursor-pointer ${
                    statusFilter === opt.val
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-955 border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  {opt.lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Inbox card feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-150 dark:divide-gray-800">
            {loading && emails.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider animate-pulse">Loading inbox...</span>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center">
                <Inbox className="w-10 h-10 text-gray-300 dark:text-gray-700 mb-2" />
                <h4 className="text-xs font-bold text-gray-800 dark:text-gray-300">No emails found</h4>
                <p className="text-[10px] text-gray-400 px-6 mt-1">There are no inbound tickets matching this query.</p>
              </div>
            ) : (
              filteredEmails.map((item) => {
                const isSelected = selectedEmail?.id === item.id
                const friendlyDate = new Date(item.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })
                const statusColor = STATUS_COLORS[item.status] || '#9ca3af'

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectEmail(item)}
                    className={`p-4 transition-all cursor-pointer relative hover:bg-gray-50/50 dark:hover:bg-gray-805/30 ${
                      isSelected ? 'bg-emerald-50/10 dark:bg-emerald-950/10 border-l-4 border-l-emerald-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-extrabold text-gray-850 dark:text-gray-200 truncate max-w-[150px]">
                        {item.from_name || item.from_email.split('@')[0]}
                      </span>
                      <span className="text-[9px] font-medium text-gray-400 shrink-0">{friendlyDate}</span>
                    </div>
                    
                    <h4 className="text-xs font-extrabold text-gray-900 dark:text-white mt-1.5 truncate">
                      {item.subject}
                    </h4>
                    
                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.body_text}
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                      <span 
                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border"
                        style={{
                          borderColor: `${statusColor}40`,
                          backgroundColor: `${statusColor}10`,
                          color: statusColor
                        }}
                      >
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                      
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-700" />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Side: Reading & Editing pane (cols 8) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl overflow-hidden flex flex-col shadow-sm">
          {!selectedEmail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 animate-pulse">
                <Mail className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">AI Email Dispatch Dashboard</h3>
              <p className="text-xs text-gray-400 mt-2 max-w-sm leading-relaxed">
                Select an incoming customer ticket from the inbox feed to view the complete body details and generate/approve AI draft replies.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              
              {/* Detailed reading pane header */}
              <div className="p-6 border-b border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-955/20 shrink-0 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white tracking-tight leading-normal">
                    {selectedEmail.subject}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Ingested: {new Date(selectedEmail.created_at).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">
                      From: <strong className="text-gray-800 dark:text-gray-200">{selectedEmail.from_name || 'Anonymous'}</strong> ({selectedEmail.from_email})
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTicket(selectedEmail.id)}
                  disabled={actionLoading}
                  className="p-2 border border-transparent rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Delete ticket"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Scrollable contents split between email body and AI reply editor */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Original Customer Email */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Original Inbound Content</h4>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-955 border border-gray-150 dark:border-gray-850 rounded-2xl p-5 text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed whitespace-pre-wrap select-text shadow-inner">
                    {selectedEmail.body_text}
                  </div>
                </div>

                {/* 2. AI Reply Draft Card */}
                <div className="border-t border-gray-150 dark:border-gray-800 pt-6">
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-1.5">
                      <CornerUpLeft className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">AI Generated Response</h4>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReGenerateDraft(selectedEmail.id)}
                        disabled={reGenLoading || actionLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-805 text-gray-650 dark:text-gray-300 hover:bg-gray-50 rounded-xl text-[10px] font-extrabold uppercase tracking-wide disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {reGenLoading ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Drafting...</>
                        ) : (
                          <><RefreshCw className="w-3.5 h-3.5" /> Re-Draft AI</>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Reply draft input block */}
                  <div className="relative bg-white dark:bg-gray-900 border border-emerald-500/20 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all shadow-sm">
                    <textarea
                      rows={8}
                      value={draftText}
                      onChange={(e) => {
                        setDraftText(e.target.value)
                        setIsEditingDraft(true)
                      }}
                      disabled={actionLoading || reGenLoading}
                      className="w-full px-5 py-4 bg-transparent border-0 text-xs text-gray-800 dark:text-gray-100 font-semibold focus:outline-none resize-none leading-relaxed select-text"
                      placeholder="Type custom response or let Gemini draft it..."
                    />

                    {/* Quick status bar inside textarea box */}
                    <div className="px-5 py-2.5 bg-gray-50/50 dark:bg-gray-955/30 border-t border-gray-100 dark:border-gray-805 flex items-center justify-between text-[9px] font-bold text-gray-400 select-none">
                      <span>Tone: Professional Inquiries Agent</span>
                      {isEditingDraft && (
                        <span className="text-amber-500 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> Unsaved draft changes
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer (Approved/Sent details) */}
              <div className="p-4 border-t border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-955/20 shrink-0 flex items-center justify-between">
                
                {/* Save draft changes */}
                <button
                  onClick={() => handleAction(selectedEmail.id, 'save' as any)}
                  disabled={actionLoading || reGenLoading || !isEditingDraft}
                  className="inline-flex items-center gap-1.5 px-4.5 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-650 dark:text-gray-300 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Draft Changes
                </button>

                {/* Discard / Send approval triggers */}
                <div className="flex items-center gap-3">
                  {selectedEmail.status !== 'ignored' && (
                    <button
                      onClick={() => handleAction(selectedEmail.id, 'ignored')}
                      disabled={actionLoading || reGenLoading}
                      className="px-4 py-2.5 border border-transparent text-gray-450 hover:text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/10 transition-all cursor-pointer"
                    >
                      Ignore Ticket
                    </button>
                  )}
                  
                  {selectedEmail.status !== 'sent' ? (
                    <button
                      onClick={() => handleAction(selectedEmail.id, 'sent')}
                      disabled={actionLoading || reGenLoading}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer"
                    >
                      {actionLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                      ) : (
                        <>Approve & Send Reply <Send className="w-4 h-4" /></>
                      )}
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-4 py-2 border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 rounded-xl text-xs font-black">
                      <CheckCircle2 className="w-4 h-4" /> Reply Sent Successfully
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  )
}
