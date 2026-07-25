'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useOrg } from '@/contexts/OrgContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import { 
  X, Search, Calendar, Clock, Trash2, Check, Edit2, 
  MessageSquare, Sun, Moon, RefreshCw, AlertCircle 
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'

const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalTimeString = (d: Date) => {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

interface FollowupReminder {
  id: string
  conversation_id: string
  phone_number: string
  name?: string
  followup_date?: string
  followup_notes?: string
  followup_notified?: boolean
  conversations: {
    id: string
    name: string
    phone_number: string
    assigned_to?: string | null
  }
}

export default function FollowupsPage() {
  return (
    <ProtectedRoute>
      <FollowupsContent />
    </ProtectedRoute>
  )
}

function FollowupsContent() {
  const router = useRouter()
  const { profile } = useOrg()
  
  // Theme state
  const [dark, setDark] = useState(false)

  // Data states
  const [reminders, setReminders] = useState<FollowupReminder[]>([])
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all')

  // Edit Modal States
  const [showFollowupModal, setShowFollowupModal] = useState(false)
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState<FollowupReminder | null>(null)
  const [modalDate, setModalDate] = useState<Date | null>(null)
  const [modalNotes, setModalNotes] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [customDateVal, setCustomDateVal] = useState('')
  const [customTimeVal, setCustomTimeVal] = useState('')
  const [savingFollowup, setSavingFollowup] = useState(false)

  // Complete/Mark Done Modal States
  const [showMarkDoneModal, setShowMarkDoneModal] = useState(false)
  const [selectedLeadForDone, setSelectedLeadForDone] = useState<FollowupReminder | null>(null)
  const [activityType, setActivityType] = useState('followup_call')
  const [activityDesc, setActivityDesc] = useState('Followup via Call')
  const [activityNotes, setActivityNotes] = useState('')
  const [savingActivity, setSavingActivity] = useState(false)

  // Sync theme on mount and change
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setDark(isDark)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Load team users and active reminders
  useEffect(() => {
    if (!profile?.id) return

    fetchUsers()
    fetchFollowups()
  }, [profile?.id, profile?.role])

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/users', {
        headers: session?.access_token
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {}
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          const map: Record<string, string> = {}
          data.forEach((u: any) => {
            map[u.id] = u.name
          })
          setUsersMap(map)
        }
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  const fetchFollowups = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/followups', {
        headers: session?.access_token
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {}
      })
      if (res.ok) {
        const data = await res.json()
        setReminders(data || [])
      } else {
        console.error('Failed to fetch follow-ups:', res.statusText)
      }
    } catch (err) {
      console.error('Failed to fetch follow-ups:', err)
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------------------------------------------
  // Handlers for Reminder Actions
  // ----------------------------------------------------------------

  // 1. Cancel Followup Reminder
  const handleCancelFollowup = async (reminder: FollowupReminder) => {
    if (!reminder.conversation_id) return
    if (!window.confirm(`Are you sure you want to cancel the followup reminder for ${reminder.conversations.name || reminder.conversations.phone_number}?`)) return
 
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          conversation_id: reminder.conversation_id,
          followup_date: null,
          followup_notes: null,
          followup_notified: false
        })
      })
 
      if (res.ok) {
        // Refresh local list
        setReminders(prev => prev.filter(r => r.id !== reminder.id))
      } else {
        alert('Failed to cancel followup')
      }
    } catch (err) {
      console.error('Error cancelling followup:', err)
    }
  }

  // 2. Open Edit/Reschedule Modal
  const openEditModal = (reminder: FollowupReminder) => {
    setSelectedLeadForEdit(reminder)
    setModalNotes(reminder.followup_notes || '')
    if (reminder.followup_date) {
      const existing = new Date(reminder.followup_date)
      setModalDate(existing)
      setCustomMode(true)
      setCustomDateVal(getLocalDateString(existing))
      setCustomTimeVal(getLocalTimeString(existing))
    } else {
      const defaultDate = new Date()
      defaultDate.setHours(defaultDate.getHours() + 2, 0, 0, 0)
      setModalDate(defaultDate)
      setCustomMode(false)
      setCustomDateVal(getLocalDateString(defaultDate))
      setCustomTimeVal(getLocalTimeString(defaultDate))
    }
    setShowFollowupModal(true)
  }

  // Reschedule update Custom Time Date handler
  const updateCustomDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return
    const [year, month, day] = dateStr.split('-').map(Number)
    const [hour, min] = timeStr.split(':').map(Number)
    const d = new Date(year, month - 1, day, hour, min, 0, 0)
    setModalDate(d)
  }

  // Reschedule save handler
  const handleSaveFollowup = async () => {
    if (!selectedLeadForEdit?.conversation_id || !modalDate) return
    setSavingFollowup(true)
    try {
      const isoString = modalDate.toISOString()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          conversation_id: selectedLeadForEdit.conversation_id,
          followup_date: isoString,
          followup_notes: modalNotes,
          followup_notified: false
        })
      })
 
      if (res.ok) {
        setShowFollowupModal(false)
        await fetchFollowups()
      } else {
        alert('Failed to save rescheduled followup')
      }
    } catch (err) {
      console.error('Error saving rescheduled followup:', err)
    } finally {
      setSavingFollowup(false)
    }
  }

  // 3. Open Complete/Mark Done Modal
  const openMarkDoneModal = (reminder: FollowupReminder) => {
    setSelectedLeadForDone(reminder)
    setActivityType('followup_call')
    setActivityDesc('Followup via Call')
    setActivityNotes(reminder.followup_notes || '')
    setShowMarkDoneModal(true)
  }

  // Complete save handler
  const handleMarkFollowupDone = async () => {
    if (!selectedLeadForDone?.id || !selectedLeadForDone?.conversation_id) return
    setSavingActivity(true)
    try {
      // 1. Log activity to timeline
      await fetch('/api/lead-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadForDone.id,
          activity_type: activityType,
          description: activityDesc.trim(),
          notes: activityNotes.trim() || selectedLeadForDone.followup_notes
        })
      })
 
      // 2. Clear followup dates on lead record
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          conversation_id: selectedLeadForDone.conversation_id,
          followup_date: null,
          followup_notes: null,
          followup_notified: false
        })
      })
 
      if (res.ok) {
        setShowMarkDoneModal(false)
        setActivityNotes('')
        await fetchFollowups()
      } else {
        alert('Failed to complete followup')
      }
    } catch (err) {
      console.error('Error completing followup:', err)
    } finally {
      setSavingActivity(false)
    }
  }

  // ----------------------------------------------------------------
  // Helper & Filtering calculations
  // ----------------------------------------------------------------

  // Presets mapping
  const getPresets = () => {
    const now = new Date()
    
    const todayPlus2 = new Date(now)
    todayPlus2.setHours(now.getHours() + 2, 0, 0, 0)
    
    const todayPlus4 = new Date(now)
    todayPlus4.setHours(now.getHours() + 4, 0, 0, 0)
    
    const formatTimePreset = (d: Date) => {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    }
    
    const getDayNamePreset = (d: Date) => {
      return d.toLocaleDateString('en-US', { weekday: 'long' })
    }

    const tomorrowPreset = new Date(now)
    tomorrowPreset.setDate(now.getDate() + 1)
    tomorrowPreset.setHours(10, 0, 0, 0)

    const getBusinessDaysAfterPreset = (days: number) => {
      let result = new Date(now)
      let added = 0
      while (added < days) {
        result.setDate(result.getDate() + 1)
        const day = result.getDay()
        if (day !== 0 && day !== 6) {
          added++
        }
      }
      result.setHours(10, 0, 0, 0)
      return result
    }

    const bus2Preset = getBusinessDaysAfterPreset(2)
    const bus6Preset = getBusinessDaysAfterPreset(6)

    return [
      { label: 'Today', sublabel: `at ${formatTimePreset(todayPlus2)}`, date: todayPlus2 },
      { label: 'Today', sublabel: `at ${formatTimePreset(todayPlus4)}`, date: todayPlus4 },
      { label: 'Tomorrow', sublabel: getDayNamePreset(tomorrowPreset), date: tomorrowPreset },
      { label: '2 business days', sublabel: getDayNamePreset(bus2Preset), date: bus2Preset },
      { label: '6 business days', sublabel: getDayNamePreset(bus6Preset), date: bus6Preset },
    ]
  }

  // Format date display
  const formatFollowupDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  // Get status details of reminder
  const getReminderStatus = (dateStr?: string): { label: string; style: string } => {
    if (!dateStr) return { label: 'Unknown', style: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' }
    const d = new Date(dateStr)
    const now = new Date()
    
    // Check if past
    if (d.getTime() < now.getTime()) {
      return { 
        label: 'Overdue', 
        style: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/60' 
      }
    }

    // Check if today
    const isToday = d.getDate() === now.getDate() && 
                    d.getMonth() === now.getMonth() && 
                    d.getFullYear() === now.getFullYear()
    if (isToday) {
      return { 
        label: 'Today', 
        style: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60' 
      }
    }

    return { 
      label: 'Upcoming', 
      style: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60' 
    }
  }

  // Filter and Search logic
  const filteredReminders = reminders.filter(r => {
    // 1. Search Query Filter
    const targetName = r.conversations?.name?.toLowerCase() || ''
    const targetPhone = r.conversations?.phone_number?.toLowerCase() || ''
    const targetNotes = r.followup_notes?.toLowerCase() || ''
    const matchesSearch = targetName.includes(searchQuery.toLowerCase()) || 
                          targetPhone.includes(searchQuery.toLowerCase()) || 
                          targetNotes.includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    // 2. Status Type Filter
    if (filterType === 'all') return true
    
    const { label } = getReminderStatus(r.followup_date)
    return label.toLowerCase() === filterType
  })

  const countByStatus = (status: 'overdue' | 'today' | 'upcoming') => {
    return reminders.filter(r => {
      const { label } = getReminderStatus(r.followup_date)
      return label.toLowerCase() === status
    }).length
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      
      {/* Header bar */}
      <header className="h-12 flex items-center justify-between px-4 bg-emerald-600 shrink-0 z-10 text-white shadow-md">
        <div className="flex items-center gap-2">
          <Sidebar />
          <Calendar className="w-5 h-5 text-white ml-1" />
          <span className="font-semibold text-sm">Followups Control Panel</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark(d => !d)}
            className="p-1.5 rounded-lg text-emerald-100 hover:bg-emerald-700 transition-colors"
            title="Toggle theme"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto w-full">
        
        {/* Top Controls Box */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                filterType === 'all'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-750'
              }`}
            >
              All Reminders ({reminders.length})
            </button>
            <button
              onClick={() => setFilterType('overdue')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                filterType === 'overdue'
                  ? 'bg-red-600 border-red-600 text-white shadow-sm'
                  : 'bg-white text-red-600 border-red-200 hover:bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-950 dark:hover:bg-red-950/20'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Overdue ({countByStatus('overdue')})
            </button>
            <button
              onClick={() => setFilterType('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                filterType === 'today'
                  ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                  : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50 dark:bg-gray-800 dark:text-amber-400 dark:border-amber-950 dark:hover:bg-amber-950/20'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Today ({countByStatus('today')})
            </button>
            <button
              onClick={() => setFilterType('upcoming')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                filterType === 'upcoming'
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                  : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:bg-gray-800 dark:text-emerald-400 dark:border-emerald-950 dark:hover:bg-emerald-950/20'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Upcoming ({countByStatus('upcoming')})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, phone, notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
            <p className="text-sm text-gray-500">Loading active reminders...</p>
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              All caught up!
            </h3>
            <p className="text-xs text-gray-500 max-w-sm">
              {searchQuery || filterType !== 'all' 
                ? 'No follow-up reminders match your search or active filters.'
                : 'There are no active follow-up reminders scheduled right now.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReminders.map(reminder => {
              const status = getReminderStatus(reminder.followup_date)
              const assignedName = reminder.conversations?.assigned_to 
                ? usersMap[reminder.conversations.assigned_to] || 'Team member'
                : null

              return (
                <div 
                  key={reminder.id} 
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-950 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Name/Phone and status */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
                          {reminder.conversations?.name || reminder.conversations?.phone_number}
                        </h4>
                        {reminder.conversations?.name && (
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                            {reminder.conversations?.phone_number}
                          </p>
                        )}
                      </div>
                      
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${status.style}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Assignment (Only for Admin, helpful to view) */}
                    {isAdmin && (
                      <div className="mb-3 flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 font-medium">Assigned to:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          assignedName 
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {assignedName || 'Unassigned'}
                        </span>
                      </div>
                    )}

                    {/* Followup Date & Time */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 mb-3 bg-gray-50 dark:bg-gray-950/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800/40">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-medium">
                        {formatFollowupDate(reminder.followup_date)}
                      </span>
                    </div>

                    {/* Notes */}
                    {reminder.followup_notes ? (
                      <div className="mb-4 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100/60 dark:border-amber-950/40 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Reminder Notes</p>
                        <p className="text-xs text-gray-650 dark:text-gray-300 leading-normal line-clamp-3 whitespace-pre-wrap">
                          {reminder.followup_notes}
                        </p>
                      </div>
                    ) : (
                      <div className="mb-4 border border-dashed border-gray-200 dark:border-gray-800/60 p-3 rounded-xl text-center">
                        <p className="text-xs text-gray-400 italic">No notes added</p>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-800 mt-2">
                    {/* Open Chat */}
                    <Link
                      href={`/?conversation_id=${reminder.conversation_id}`}
                      className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-xl text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
                      title="Open chat window"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Open Chat
                    </Link>

                    {/* Mark Done */}
                    <button
                      onClick={() => openMarkDoneModal(reminder)}
                      className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors"
                      title="Mark as Done"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEditModal(reminder)}
                      className="p-2 border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl transition-colors"
                      title="Reschedule Followup"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Cancel */}
                    <button
                      onClick={() => handleCancelFollowup(reminder)}
                      className="p-2 border border-red-100 hover:bg-red-50 dark:border-red-950/30 dark:hover:bg-red-950/50 text-red-500 rounded-xl transition-colors"
                      title="Cancel Followup"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Reschedule Modal */}
      {/* ---------------------------------------------------------------- */}
      {showFollowupModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0" onClick={() => setShowFollowupModal(false)} />
          
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl border-t md:border border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-50 animate-slide-up flex flex-col space-y-4 text-gray-900 dark:text-white">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFollowupModal(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold">Reschedule follow up</h4>
              </div>
              {modalDate && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                  {formatFollowupDate(modalDate.toISOString())}
                </span>
              )}
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2">
              {getPresets().map((preset, idx) => {
                const isSelected = modalDate && Math.abs(modalDate.getTime() - preset.date.getTime()) < 1000 * 60;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setModalDate(preset.date);
                      setCustomMode(false);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                      isSelected && !customMode
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-400 font-medium'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-905 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/80'
                    }`}
                  >
                    <span className="text-xs font-semibold">{preset.label}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{preset.sublabel}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setCustomMode(true);
                  if (!modalDate) setModalDate(new Date());
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  customMode
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-400 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-905 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/80'
                }`}
              >
                <span className="text-xs font-semibold">Custom Date</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Choose Date/Time</span>
              </button>
            </div>

            {/* Custom Inputs */}
            {customMode && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    value={customDateVal}
                    onChange={(e) => {
                      setCustomDateVal(e.target.value);
                      updateCustomDateTime(e.target.value, customTimeVal);
                    }}
                    className="w-full text-xs text-gray-705 dark:text-gray-300 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase tracking-wider">Time</label>
                  <input
                    type="time"
                    value={customTimeVal}
                    onChange={(e) => {
                      setCustomTimeVal(e.target.value);
                      updateCustomDateTime(customDateVal, e.target.value);
                    }}
                    className="w-full text-xs text-gray-705 dark:text-gray-300 bg-gray-55 dark:bg-gray-950 border border-gray-200 dark:border-gray-850 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Follow-up Notes */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Add Notes</label>
              <textarea
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="Enter notes about this follow-up..."
                rows={3}
                className="w-full text-xs text-gray-705 dark:text-gray-300 bg-gray-55 dark:bg-gray-950 rounded-xl p-3 border border-gray-200 dark:border-gray-850 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
              />
            </div>

            {/* Save Button */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowFollowupModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFollowup}
                disabled={savingFollowup || !modalDate}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                {savingFollowup ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Save Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Complete Followup Modal */}
      {/* ---------------------------------------------------------------- */}
      {showMarkDoneModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0" onClick={() => setShowMarkDoneModal(false)} />
          
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl border-t md:border border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-50 animate-slide-up flex flex-col space-y-4 text-gray-900 dark:text-white">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMarkDoneModal(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold">Complete Followup</h4>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-normal">
              Marking this reminder as done will log it to the lead timeline and clear the active alert.
            </p>

            {/* Selector Grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'followup_call', label: 'Followup via Call', desc: 'Followup via Call' },
                { type: 'followup_whatsapp', label: 'Followup via WhatsApp', desc: 'Followup via WhatsApp' }
              ].map((item) => {
                const isSelected = activityType === item.type
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setActivityType(item.type)
                      setActivityDesc(item.desc)
                    }}
                    className={`p-3 rounded-2xl border text-xs font-semibold text-center transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-400 font-medium'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-905 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/85'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {/* Custom Notes Textarea */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Followup Summary / Notes</label>
              <textarea
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                placeholder="Describe how the follow-up went..."
                rows={3}
                className="w-full text-xs text-gray-705 dark:text-gray-300 bg-gray-55 dark:bg-gray-950 rounded-xl p-3 border border-gray-200 dark:border-gray-850 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowMarkDoneModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkFollowupDone}
                disabled={savingActivity}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                {savingActivity ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Confirm Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
