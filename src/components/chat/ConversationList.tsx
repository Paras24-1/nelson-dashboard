'use client'

import { useState, useEffect } from 'react'
import { Conversation, Stage } from '@/types'
import { useConversations } from '@/hooks'
import { formatDistanceToNow } from 'date-fns'
import { Search, Filter, Wifi, Trash2, X, UserPlus } from 'lucide-react'
import { useOrg } from '@/contexts/OrgContext'
import { supabase } from '@/lib/supabaseClient'

const STAGES: Stage[] = ['new', 'interested', 'booking', 'confirmed', 'cancelled', 'completed', 'followup', 'not_interested', 'call_done', 'low_budget', 'hot_customer', 'not_connected']

const STAGE_COLORS: Record<Stage, string> = {
  new:        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  interested: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  booking:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  confirmed:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:  'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  completed:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  followup:      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  not_interested:'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    call_done:      'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  low_budget:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
hot_customer:'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
not_connected:  'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
}

interface Props {
  selectedId: string | null
  onSelect: (conv: Conversation) => void
  onDelete?: (id: string) => void
}

interface Employee {
  id: string
  name: string
  email: string
}

export default function ConversationList({ selectedId, onSelect, onDelete }: Props) {
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [unread, setUnread] = useState(false)
  const [assignedFilter, setAssignedFilter] = useState<string>('all') // all, unassigned, assigned, or employee_id
  const [channelFilter, setChannelFilter] = useState<string>('all') // all, whatsapp, instagram
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showAddLead, setShowAddLead] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const { profile } = useOrg()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  console.log('DEBUG:', { profile, isAdmin, role: profile?.role })



  const { conversations, loading, refetch } = useConversations({ 
  search, 
  stage, 
  unread,
  assignFilter: assignedFilter,
  userId: profile?.id,
  isAdmin: !!isAdmin,
  userRole: profile?.role,
})

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'owner') {
      fetchEmployees()
    }
  }, [profile])

  const fetchEmployees = async () => {
    if (!profile?.org_id) return
    const { data } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'employee')
      .eq('org_id', profile.org_id)
      .order('name')
    
    if (data) setEmployees(data)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setConfirmId(id)
  }

  const confirmDelete = async () => {
    if (!confirmId) return
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/conversations/${confirmId}`, {
        method: 'DELETE',
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        }
      })
      if (res.ok) {
        onDelete?.(confirmId)
        refetch()
      }
    } finally {
      setDeleting(false)
      setConfirmId(null)
    }
  }


  const hasInstagram = conversations.some(c => c.platform === 'instagram')

  return (
    <aside className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-950">
      {/* Add Lead & Initiate Chat Modal */}
      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onSuccess={(newConv) => {
            refetch()
            onSelect(newConv)
            setShowAddLead(false)
          }}
          profile={profile}
        />
      )}

      {/* Confirm Delete Modal */}
      {confirmId && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-xs shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Delete Conversation?</h3>
              <button onClick={() => setConfirmId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              This will permanently delete the conversation and all messages. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-gray-150 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
              <span>{isAdmin ? 'All Conversations' : 'My Chats'}</span>
              <button
                onClick={() => setShowAddLead(true)}
                className="p-1.5 rounded-xl text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/30 hover:bg-emerald-100 transition-colors"
                title="Add New Lead & Start Chat"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </h2>
            {!isAdmin && profile?.name && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                👤 {profile.name}
              </p>
            )}
          </div>
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-100/20 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          
          {/* Assignment Filter (Admin only) */}
          {isAdmin && (
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All chats</option>
              <option value="unassigned">Unassigned</option>
              <option value="assigned">All Assigned</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          )}
          
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          {hasInstagram && (
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
          )}
          
          <button
            onClick={() => setUnread((u) => !u)}
            className={`text-xs px-2.5 py-1.5 rounded-xl font-medium border transition-all duration-200 shadow-sm ${
              unread
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/10'
                : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50'
            }`}
          >
            Unread
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1.5 bg-gray-50/40 dark:bg-gray-950/20">
        {loading ? (
          <LoadingSkeleton />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
            <span>No conversations found</span>
          </div>
        ) : (
          [...conversations]
            .filter((c) => {
              if (channelFilter === 'whatsapp') return !c.platform || c.platform === 'whatsapp'
              if (channelFilter === 'instagram') return c.platform === 'instagram'
              return true
            })
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedId}
                onClick={() => onSelect(conv)}
                onDelete={(e) => handleDelete(e, conv.id)}
                isAdmin={isAdmin}
                employees={employees}
                onAssignmentChange={refetch}
              />
            ))
        )}
      </div>
    </aside>
  )
}

function ConversationItem({
  conversation: conv,
  isSelected,
  onClick,
  onDelete,
  isAdmin,
  employees,
  onAssignmentChange,
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
  isAdmin: boolean
  employees: Employee[]
  onAssignmentChange: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const initials = (conv.name || conv.phone_number || 'U')
  .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const timeAgo = formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })

  const assignedEmployee = employees.find(e => e.id === conv.assigned_to)

  const handleAssign = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation()
    setAssigning(true)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          conversation_id: conv.id,
          assigned_to: userId
        })
      })

      if (res.ok) {
        onAssignmentChange()
        setShowAssign(false)
      }
    } catch (err) {
      console.error('Assignment failed:', err)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div
      className={`relative flex items-start gap-3 px-3 py-3 cursor-pointer transition-all duration-200 rounded-xl ${
        isSelected
          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-l-emerald-500 shadow-sm'
          : 'hover:bg-gray-100/70 dark:hover:bg-gray-900/50'
      }`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className="relative shrink-0 select-none">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-md border border-emerald-400/20">
          {initials}
        </div>
        {!conv.ai_mode && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-orange-400 border-2 border-white dark:border-gray-950 shadow-sm" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'}`}>
            {conv.name}
          </span>
          <span className="text-[9px] text-gray-400 font-semibold shrink-0 ml-2">{timeAgo}</span>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mb-1">
          {conv.phone_number}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-relaxed">
          {conv.last_message || 'No messages yet'}
        </p>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${STAGE_COLORS[conv.stage as Stage] || STAGE_COLORS.new}`}>
            {conv.stage}
          </span>

          {/* Platform Badge */}
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            conv.platform === 'instagram'
              ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border border-pink-100/10'
              : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-100/10'
          }`}>
            {conv.platform || 'whatsapp'}
          </span>
          
          {/* Assignment Badge */}
          {assignedEmployee && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100/10">
              → {assignedEmployee.name.split(' ')[0]}
            </span>
          )}
          {!assignedEmployee && isAdmin && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-55 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100/10">
              Unassigned
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {hovered && (
        <div className="flex items-center gap-1 shrink-0 select-none">
          {isAdmin && !showAssign && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAssign(true); }}
              className="p-1 rounded-lg bg-blue-55 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors border border-blue-100/20"
              title="Assign to employee"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-400 hover:bg-red-100 hover:text-red-650 transition-colors border border-red-100/20"
            title="Delete conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Unread badge */}
      {conv.unread_count > 0 && (
        <span className="shrink-0 min-w-[18px] h-4.5 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center px-1 shadow-md animate-pulse">
          {conv.unread_count > 99 ? '99+' : conv.unread_count}
        </span>
      )}

      {/* Assignment Dropdown */}
      {showAssign && (
        <div className="absolute right-2 top-2 z-10 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[160px]">
          <p className="text-[10px] font-extrabold uppercase text-gray-400 mb-2 px-2">Assign to:</p>
          {employees.map((emp) => (
            <button
              key={emp.id}
              onClick={(e) => handleAssign(e, emp.id)}
              disabled={assigning}
              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50"
            >
              {emp.name}
            </button>
          ))}
          <button
            onClick={(e) => { e.stopPropagation(); setShowAssign(false); }}
            className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-3.5 py-3 rounded-xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-900/40">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-850 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-3/4" />
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-full" />
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function AddLeadModal({
  onClose,
  onSuccess,
  profile
}: {
  onClose: () => void
  onSuccess: (conv: any) => void
  profile: any
}) {
  const [leadName, setLeadName] = useState('')
  const [phone, setPhone] = useState('')
  const [templates, setTemplates] = useState<any[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null)
  const [variables, setVariables] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadTemplates() {
      setLoadingTemplates(true)
      setError('')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/templates', {
          headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to fetch templates')
        }
        const data = await res.json()
        setTemplates(data || [])
      } catch (err: any) {
        setError(err.message || 'Error loading templates')
      } finally {
        setLoadingTemplates(false)
      }
    }
    loadTemplates()
  }, [])

  const handleTemplateChange = (templateName: string) => {
    const template = templates.find(t => t.name === templateName)
    setSelectedTemplate(template || null)
    if (template && template.variables) {
      setVariables(new Array(template.variables.length).fill(''))
    } else {
      setVariables([])
    }
  }

  const handleVariableChange = (index: number, value: string) => {
    setVariables(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!leadName || !phone || !selectedTemplate) {
      setError('Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      // Reconstruct preview message
      let previewMessage = selectedTemplate.body || ''
      variables.forEach((val, i) => {
        previewMessage = previewMessage.replace(`{{${i + 1}}}`, val)
      })

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/conversations/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          phone,
          name: leadName,
          template_name: selectedTemplate.name,
          template_lang: selectedTemplate.language,
          variables,
          message_text: previewMessage,
          userId: profile?.id
        })
      })

      const resData = await res.json()
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to initiate conversation')
      }

      onSuccess(resData.conversation)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const getPreviewText = () => {
    if (!selectedTemplate) return ''
    let text = selectedTemplate.body || ''
    variables.forEach((val, i) => {
      text = text.replace(`{{${i + 1}}}`, val || `[Variable ${i + 1}]`)
    })
    return text
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-emerald-600 dark:bg-emerald-700">
          <h3 className="text-base font-semibold text-white">Add Lead & Initiate Chat</h3>
          <button type="button" onClick={onClose} className="text-emerald-100 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium border border-red-100 dark:border-red-900/40">
              ⚠️ {error}
            </div>
          )}

          {/* Lead Name */}
          <div>
            <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 tracking-wider">
              LEAD NAME *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 tracking-wider">
              PHONE NUMBER * (With country code, e.g. 919739755997)
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. 919739755997"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Select Template */}
          <div>
            <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1 tracking-wider">
              SELECT WHATSAPP TEMPLATE *
            </label>
            {loadingTemplates ? (
              <div className="text-xs text-gray-400 animate-pulse py-2">Loading templates from Meta...</div>
            ) : (
              <select
                required
                value={selectedTemplate?.name || ''}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Choose Template --</option>
                {templates.map((t) => (
                  <option key={t.id || t.name} value={t.name}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dynamic Variables Inputs */}
          {selectedTemplate && selectedTemplate.variables?.length > 0 && (
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-850 rounded-2xl border border-gray-105 dark:border-gray-750">
              <h4 className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Template Variables
              </h4>
              {selectedTemplate.variables.map((v: string, i: number) => (
                <div key={i}>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">
                    VARIABLE {i + 1}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`Enter value for ${v}`}
                    value={variables[i] || ''}
                    onChange={(e) => handleVariableChange(i, e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-850 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Template Preview */}
          {selectedTemplate && (
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl">
              <h4 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                Message Preview
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {getPreviewText()}
              </p>
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Initiating...</span>
                </>
              ) : (
                <span>Send & Start Chat</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
