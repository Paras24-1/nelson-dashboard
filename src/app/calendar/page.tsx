'use client'

import { useState, useEffect } from 'react'
import { useOrg } from '@/contexts/OrgContext'
import Sidebar from '@/components/Sidebar'
import { 
  Calendar as CalendarIcon, Clock, Video, MapPin, Phone, User, Plus, Code, Copy, Check, 
  Trash2, ExternalLink, Filter, Search, Globe, ShieldAlert, Sparkles, RefreshCw, ChevronRight, ArrowLeft
} from 'lucide-react'

interface TimeInterval {
  start: string
  end: string
}

interface DaySchedule {
  enabled: boolean
  intervals: TimeInterval[]
}

type WeeklySchedule = Record<string, DaySchedule>

const DAYS_LIST = [
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'sun', label: 'Sunday' }
]

const INITIAL_WEEKLY_SCHEDULE: WeeklySchedule = {
  mon: { enabled: true, intervals: [{ start: '10:00', end: '15:00' }, { start: '17:00', end: '19:00' }] },
  tue: { enabled: true, intervals: [{ start: '10:00', end: '15:00' }, { start: '17:00', end: '19:00' }] },
  wed: { enabled: true, intervals: [{ start: '10:00', end: '15:00' }] },
  thu: { enabled: true, intervals: [{ start: '10:00', end: '15:00' }] },
  fri: { enabled: true, intervals: [{ start: '10:00', end: '15:00' }] },
  sat: { enabled: false, intervals: [{ start: '10:00', end: '14:00' }] },
  sun: { enabled: false, intervals: [{ start: '10:00', end: '14:00' }] }
}

interface EventType {
  id?: string
  org_id?: string
  title: string
  slug: string
  description?: string
  duration_minutes: number
  location_type: 'google_meet' | 'zoom' | 'phone_call' | 'in_person'
  location_url?: string
  available_days: string[]
  weekly_schedule?: WeeklySchedule
  start_time: string
  end_time: string
  timezone: string
  slot_interval: number
  buffer_minutes: number
  min_notice_hours: number
  redirect_url?: string
  n8n_calendar_webhook_url?: string
  created_at?: string
}

interface Appointment {
  id: string
  event_type_id: string
  attendee_name: string
  attendee_email: string
  attendee_phone: string
  notes?: string
  booking_date: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled' | 'completed'
  meeting_link?: string
  created_at: string
}

export default function CalendarDashboardPage() {
  const { org } = useOrg()
  const [activeTab, setActiveTab] = useState<'appointments' | 'events' | 'create'>('appointments')

  // Feature Flag Gating Check
  const isAllowed = Boolean(org?.has_calendar)

  // Data states
  const [events, setEvents] = useState<EventType[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedEmbedId, setCopiedEmbedId] = useState<string | null>(null)

  // Wizard state for event creation
  const [wizardStep, setWizardStep] = useState<number>(1)
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(INITIAL_WEEKLY_SCHEDULE)
  const [copyingDay, setCopyingDay] = useState<string | null>(null)
  const [selectedCopyDays, setSelectedCopyDays] = useState<string[]>([])
  const [showSelectedDaysMenu, setShowSelectedDaysMenu] = useState(false)

  const [formData, setFormData] = useState<EventType>({
    title: '',
    slug: '',
    description: '',
    duration_minutes: 30,
    location_type: 'google_meet',
    location_url: '',
    available_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weekly_schedule: INITIAL_WEEKLY_SCHEDULE,
    start_time: '10:00',
    end_time: '18:00',
    timezone: 'Asia/Kolkata',
    slot_interval: 30,
    buffer_minutes: 10,
    min_notice_hours: 4,
    redirect_url: ''
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      description: '',
      duration_minutes: 30,
      location_type: 'google_meet',
      location_url: '',
      available_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      weekly_schedule: INITIAL_WEEKLY_SCHEDULE,
      start_time: '10:00',
      end_time: '18:00',
      timezone: 'Asia/Kolkata',
      slot_interval: 30,
      buffer_minutes: 10,
      min_notice_hours: 4,
      redirect_url: '',
      n8n_calendar_webhook_url: ''
    })
    setWeeklySchedule(INITIAL_WEEKLY_SCHEDULE)
  }

  useEffect(() => {
    if (org?.id && isAllowed) {
      fetchCalendarData()
    } else {
      setLoading(false)
    }
  }, [org?.id, isAllowed])

  const fetchCalendarData = async () => {
    setLoading(true)
    try {
      const [eventsRes, aptsRes] = await Promise.all([
        fetch(`/api/calendar/events?org_id=${org?.id}`),
        fetch(`/api/calendar/appointments?org_id=${org?.id}`)
      ])

      if (eventsRes.ok) {
        const evtData = await eventsRes.json()
        if (Array.isArray(evtData)) setEvents(evtData)
      }
      if (aptsRes.ok) {
        const aptData = await aptsRes.json()
        if (Array.isArray(aptData)) setAppointments(aptData)
      }
    } catch (err) {
      console.error('Failed to fetch calendar data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/book/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleCopyEmbed = (slug: string, id: string) => {
    const embedCode = `<iframe src="${window.location.origin}/book/${slug}" width="100%" height="700px" frameborder="0"></iframe>`
    navigator.clipboard.writeText(embedCode)
    setCopiedEmbedId(id)
    setTimeout(() => setCopiedEmbedId(null), 2500)
  }

  const handleDeleteCalendar = async (id: string, slug: string, title: string) => {
    const targetId = id || slug
    if (!org?.id || !targetId) return
    if (!confirm(`Are you sure you want to delete the "${title}" calendar? This action cannot be undone.`)) return

    try {
      const res = await fetch(`/api/calendar/events?id=${encodeURIComponent(targetId)}&org_id=${encodeURIComponent(org.id)}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete calendar')
      await fetchCalendarData()
    } catch (err: any) {
      alert(err.message || 'Failed to delete calendar')
    }
  }

  // --- WEEKLY SCHEDULE HELPER FUNCTIONS ---
  const handleToggleDay = (dayId: string) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        enabled: !prev[dayId]?.enabled
      }
    }))
  }

  const handleAddInterval = (dayId: string) => {
    setWeeklySchedule(prev => {
      const currentIntervals = prev[dayId]?.intervals || []
      const lastEnd = currentIntervals[currentIntervals.length - 1]?.end || '17:00'
      const [h] = lastEnd.split(':').map(Number)
      const newStartH = Math.min(22, h + 1)
      const newEndH = Math.min(23, newStartH + 2)
      const newStart = `${String(newStartH).padStart(2, '0')}:00`
      const newEnd = `${String(newEndH).padStart(2, '0')}:00`

      return {
        ...prev,
        [dayId]: {
          ...prev[dayId],
          intervals: [...currentIntervals, { start: newStart, end: newEnd }]
        }
      }
    })
  }

  const handleUpdateInterval = (dayId: string, index: number, field: 'start' | 'end', value: string) => {
    setWeeklySchedule(prev => {
      const updated = [...(prev[dayId]?.intervals || [])]
      updated[index] = { ...updated[index], [field]: value }
      return {
        ...prev,
        [dayId]: {
          ...prev[dayId],
          intervals: updated
        }
      }
    })
  }

  const handleRemoveInterval = (dayId: string, index: number) => {
    setWeeklySchedule(prev => {
      const updated = (prev[dayId]?.intervals || []).filter((_, i) => i !== index)
      return {
        ...prev,
        [dayId]: {
          ...prev[dayId],
          intervals: updated.length > 0 ? updated : [{ start: '10:00', end: '18:00' }]
        }
      }
    })
  }

  const handleApplyToAllDays = (sourceDayId: string) => {
    setWeeklySchedule(prev => {
      const source = prev[sourceDayId]
      const next = { ...prev }
      DAYS_LIST.forEach(d => {
        next[d.id] = { enabled: source.enabled, intervals: JSON.parse(JSON.stringify(source.intervals)) }
      })
      return next
    })
    setCopyingDay(null)
    setShowSelectedDaysMenu(false)
  }

  const handleApplyToWeekdays = (sourceDayId: string) => {
    setWeeklySchedule(prev => {
      const source = prev[sourceDayId]
      const next = { ...prev }
      ;['mon', 'tue', 'wed', 'thu', 'fri'].forEach(d => {
        next[d] = { enabled: source.enabled, intervals: JSON.parse(JSON.stringify(source.intervals)) }
      })
      return next
    })
    setCopyingDay(null)
    setShowSelectedDaysMenu(false)
  }

  const handleApplyToSelectedDays = (sourceDayId: string, targetDays: string[]) => {
    setWeeklySchedule(prev => {
      const source = prev[sourceDayId]
      const next = { ...prev }
      targetDays.forEach(d => {
        next[d] = { enabled: source.enabled, intervals: JSON.parse(JSON.stringify(source.intervals)) }
      })
      return next
    })
    setCopyingDay(null)
    setShowSelectedDaysMenu(false)
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center text-center relative">
        <div className="absolute top-6 left-6">
          <Sidebar />
        </div>
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Booking Calendar Disabled</h2>
        <p className="text-xs text-slate-400 max-w-md mb-6">
          The Booking Calendar feature is currently not active for your organization plan.
        </p>
        <a
          href="https://wa.me/918360599157?text=Hi,%20I%20want%20to%20enable%20the%20Booking%20Calendar%20feature."
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
        >
          <span>Request Feature Access via WhatsApp</span>
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8 space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Sidebar />
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-emerald-400" />
              Booking Calendar & Scheduler
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage client appointment slots and website embeds.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'appointments'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Upcoming Appointments ({appointments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'events'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Event Calendars ({events.length})</span>
          </button>

          <button
            onClick={() => {
              resetForm()
              setActiveTab('create')
              setWizardStep(1)
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'create'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Create New Calendar</span>
          </button>
        </div>
      </div>

      {/* TAB 1: UPCOMING APPOINTMENTS HIGH-END CALENDAR VIEW */}
      {activeTab === 'appointments' && (
        <AppointmentsCalendarView
          appointments={appointments}
          onRefresh={fetchCalendarData}
        />
      )}

      {/* TAB 2: EVENT CALENDARS LIST */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-emerald-400" />
              Active Booking Calendars
            </h3>
          </div>

          {events.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-3xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">No Event Calendars Created</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create your first booking calendar (e.g. 30 Mins Strategy Call) to start receiving bookings.
              </p>
              <button
                onClick={() => {
                  resetForm()
                  setActiveTab('create')
                  setWizardStep(1)
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Calendar Now</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map(evt => (
                <EventCalendarCard
                  key={evt.id || evt.slug}
                  evt={evt}
                  copiedId={copiedId}
                  copiedEmbedId={copiedEmbedId}
                  onCopyLink={handleCopyLink}
                  onCopyEmbed={handleCopyEmbed}
                  onDelete={handleDeleteCalendar}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CREATE NEW CALENDAR WIZARD */}
      {activeTab === 'create' && (
        <div className="max-w-3xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('events')}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-lg font-bold text-white">Create Booking Calendar</h3>
                <p className="text-xs text-slate-400">Step {wizardStep} of 4</p>
              </div>
            </div>

            {/* STEP PROGRESS INDICATORS */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map(s => (
                <div
                  key={s}
                  className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center transition-all ${
                    wizardStep === s
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                      : wizardStep > s
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-950 text-slate-600 border border-slate-800'
                  }`}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
              {saveError}
            </div>
          )}

          <div className="space-y-6">

            {/* STEP 1: CALENDAR DETAILS */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">1. Calendar Details</h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Calendar Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10x Business Strategy Call"
                    value={formData.title}
                    onChange={e => {
                      const t = e.target.value
                      setFormData({
                        ...formData,
                        title: t,
                        slug: t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                      })
                    }}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">URL Slug *</label>
                  <div className="flex items-center">
                    <span className="px-3 py-2.5 bg-slate-950 border border-r-0 border-slate-800 rounded-l-xl text-xs text-slate-500 font-mono">
                      /book/
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="strategy-call"
                      value={formData.slug}
                      onChange={e => setFormData({ ...formData, slug: e.target.value })}
                      className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-r-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Meeting Duration (Minutes)</label>
                  <select
                    value={formData.duration_minutes}
                    onChange={e => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Location / Meeting Provider *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'google_meet', label: 'Google Meet', icon: Video },
                      { id: 'zoom', label: 'Zoom', icon: Video },
                      { id: 'phone_call', label: 'Phone Call', icon: Phone },
                      { id: 'in_person', label: 'In Person', icon: MapPin }
                    ].map(loc => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, location_type: loc.id as any })}
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          formData.location_type === loc.id
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <loc.icon className="w-4 h-4" />
                        <span>{loc.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {formData.location_type === 'google_meet' && 'Google Meet Link * (Mandatory)'}
                    {formData.location_type === 'zoom' && 'Zoom Meeting Link * (Mandatory)'}
                    {formData.location_type === 'phone_call' && 'Host Phone Number * (Mandatory)'}
                    {formData.location_type === 'in_person' && 'Physical Location / Address * (Mandatory)'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      formData.location_type === 'google_meet' ? 'https://meet.google.com/abc-defg-hij' :
                      formData.location_type === 'zoom' ? 'https://zoom.us/j/123456789' :
                      formData.location_type === 'phone_call' ? '+91 9876543210' :
                      'Suite 101, 10X Business Tower, Sector 62, Noida'
                    }
                    value={formData.location_url || ''}
                    onChange={e => setFormData({ ...formData, location_url: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-amber-400 font-semibold mt-1">
                    * Required: Please enter the {formData.location_type.replace('_', ' ')} details before proceeding.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Instructions</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what this calendar is for and any instructions for attendees..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: SCHEDULE & AVAILABILITY */}
            {wizardStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      2. Schedule & Availability
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Set your weekly operating hours and custom break intervals per day.
                    </p>
                  </div>
                </div>

                {/* WEEKLY SCHEDULE DAYS CARDS */}
                <div className="space-y-3">
                  {DAYS_LIST.map(d => {
                    const sched = weeklySchedule[d.id] || { enabled: false, intervals: [{ start: '10:00', end: '18:00' }] }
                    const isCopyingThisDay = copyingDay === d.id

                    return (
                      <div
                        key={d.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          sched.enabled
                            ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-md'
                            : 'bg-slate-950/60 border-slate-900 opacity-60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          
                          {/* LEFT: TOGGLE SWITCH & DAY NAME */}
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <button
                              type="button"
                              onClick={() => handleToggleDay(d.id)}
                              className={`w-12 h-6 rounded-full p-1 transition-colors relative flex items-center ${
                                sched.enabled ? 'bg-emerald-500 shadow-inner' : 'bg-slate-800'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-slate-950 shadow-md transform transition-transform ${
                                  sched.enabled ? 'translate-x-6 bg-slate-950' : 'translate-x-0 bg-slate-400'
                                }`}
                              />
                            </button>

                            <span className={`text-xs font-bold ${sched.enabled ? 'text-white' : 'text-slate-500'}`}>
                              {d.label}
                            </span>
                          </div>

                          {/* MIDDLE: TIME INTERVALS */}
                          <div className="flex-1 space-y-2">
                            {!sched.enabled ? (
                              <span className="text-xs text-slate-500 italic font-mono">Unavailable / Closed</span>
                            ) : (
                              sched.intervals.map((inter, idx) => (
                                <div key={idx} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:border-emerald-500">
                                    <input
                                      type="time"
                                      value={inter.start}
                                      onChange={e => handleUpdateInterval(d.id, idx, 'start', e.target.value)}
                                      className="bg-transparent text-xs text-white font-mono focus:outline-none"
                                    />
                                    <Clock className="w-3 h-3 text-slate-500" />
                                  </div>

                                  <span className="text-xs text-slate-500 font-medium">to</span>

                                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:border-emerald-500">
                                    <input
                                      type="time"
                                      value={inter.end}
                                      onChange={e => handleUpdateInterval(d.id, idx, 'end', e.target.value)}
                                      className="bg-transparent text-xs text-white font-mono focus:outline-none"
                                    />
                                    <Clock className="w-3 h-3 text-slate-500" />
                                  </div>

                                  {/* Delete Interval Button */}
                                  {sched.intervals.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInterval(d.id, idx)}
                                      title="Remove Interval"
                                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {/* RIGHT: ACTION BUTTONS (+ Add & 📑 Copy) */}
                          {sched.enabled && (
                            <div className="flex items-center gap-2 self-start sm:self-center relative">
                              <button
                                type="button"
                                onClick={() => handleAddInterval(d.id)}
                                title="Add another time interval"
                                className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-xl transition-all text-xs font-semibold flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (isCopyingThisDay) {
                                    setCopyingDay(null)
                                    setShowSelectedDaysMenu(false)
                                  } else {
                                    setCopyingDay(d.id)
                                    setShowSelectedDaysMenu(false)
                                    setSelectedCopyDays(DAYS_LIST.map(item => item.id).filter(item => item !== d.id))
                                  }
                                }}
                                title={`Copy ${d.label}'s hours to other days`}
                                className={`p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1 ${
                                  isCopyingThisDay
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-blue-500/40 hover:text-blue-400'
                                }`}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {isCopyingThisDay && (
                                <div className="absolute right-0 top-11 z-50 w-72 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3 text-xs text-white">
                                  <div className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
                                    <span>Choose days to copy {d.label}'s hours</span>
                                    <button
                                      type="button"
                                      onClick={() => setCopyingDay(null)}
                                      className="text-slate-500 hover:text-white"
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <div className="space-y-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleApplyToAllDays(d.id)}
                                      className="w-full text-left px-3 py-2 bg-slate-950 hover:bg-slate-800 rounded-xl text-slate-300 font-medium transition-colors flex items-center justify-between"
                                    >
                                      <span>Apply to all days</span>
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleApplyToWeekdays(d.id)}
                                      className="w-full text-left px-3 py-2 bg-slate-950 hover:bg-slate-800 rounded-xl text-slate-300 font-medium transition-colors flex items-center justify-between"
                                    >
                                      <span>Apply to weekdays</span>
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setShowSelectedDaysMenu(!showSelectedDaysMenu)}
                                      className={`w-full text-left px-3 py-2 rounded-xl font-medium transition-colors flex items-center justify-between ${
                                        showSelectedDaysMenu
                                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                          : 'bg-slate-950 hover:bg-slate-800 text-slate-300'
                                      }`}
                                    >
                                      <span>Apply to selected days</span>
                                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showSelectedDaysMenu ? 'rotate-90 text-blue-400' : 'text-slate-500'}`} />
                                    </button>
                                  </div>

                                  {showSelectedDaysMenu && (
                                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 pt-2">
                                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                        {DAYS_LIST.map(dayItem => (
                                          <label
                                            key={dayItem.id}
                                            className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer text-xs py-1"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={selectedCopyDays.includes(dayItem.id)}
                                              onChange={e => {
                                                if (e.target.checked) {
                                                  setSelectedCopyDays([...selectedCopyDays, dayItem.id])
                                                } else {
                                                  setSelectedCopyDays(selectedCopyDays.filter(k => k !== dayItem.id))
                                                }
                                              }}
                                              className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                                            />
                                            <span>{dayItem.label}</span>
                                          </label>
                                        ))}
                                      </div>

                                      <button
                                        type="button"
                                        disabled={selectedCopyDays.length === 0}
                                        onClick={() => handleApplyToSelectedDays(d.id, selectedCopyDays)}
                                        className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-600/30"
                                      >
                                        Apply to days ({selectedCopyDays.length})
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Buffer Time Between Meetings</label>
                    <select
                      value={formData.buffer_minutes}
                      onChange={e => setFormData({ ...formData, buffer_minutes: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value={0}>No Buffer</option>
                      <option value={5}>5 Minutes</option>
                      <option value={10}>10 Minutes</option>
                      <option value={15}>15 Minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Timezone</label>
                    <input
                      type="text"
                      value={formData.timezone}
                      onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: BOOKING RULES */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">3. Booking Rules & Notices</h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Minimum Scheduling Notice (Hours)</label>
                  <select
                    value={formData.min_notice_hours}
                    onChange={e => setFormData({ ...formData, min_notice_hours: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={1}>1 Hour in advance</option>
                    <option value={2}>2 Hours in advance</option>
                    <option value={4}>4 Hours in advance</option>
                    <option value={24}>24 Hours (1 Day) in advance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Thank-You Redirect URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://yourdomain.com/thank-you"
                    value={formData.redirect_url}
                    onChange={e => setFormData({ ...formData, redirect_url: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & SAVE */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">4. Review & Create Calendar</h4>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Calendar Title:</span>
                    <span className="font-bold text-white">{formData.title || 'Untitled'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Slug / URL:</span>
                    <span className="font-mono text-emerald-400">/book/{formData.slug}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Location Details:</span>
                    <span className="font-bold text-white">{formData.location_type} ({formData.location_url})</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Duration:</span>
                    <span className="font-bold text-white">{formData.duration_minutes} Mins</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Operating Days:</span>
                    <span className="font-bold text-emerald-400 uppercase">
                      {DAYS_LIST.filter(d => weeklySchedule[d.id]?.enabled).map(d => d.id).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Navigation Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(prev => prev - 1)}
                  className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs transition-colors border border-slate-800"
                >
                  Back
                </button>
              ) : <div />}

              {wizardStep === 1 && (
                <button
                  type="button"
                  disabled={!formData.title.trim() || !formData.slug.trim() || !formData.location_url?.trim()}
                  onClick={() => setWizardStep(2)}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Next Step
                </button>
              )}

              {wizardStep === 2 && (
                <button
                  type="button"
                  disabled={DAYS_LIST.filter(d => weeklySchedule[d.id]?.enabled).length === 0}
                  onClick={() => setWizardStep(3)}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Next Step
                </button>
              )}

              {wizardStep === 3 && (
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Review & Continue
                </button>
              )}

              {wizardStep === 4 && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    if (!org?.id) return
                    setSaving(true)
                    setSaveError('')
                    try {
                      const enabledDays = DAYS_LIST.filter(d => weeklySchedule[d.id]?.enabled).map(d => d.id)
                      const res = await fetch('/api/calendar/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          ...formData, 
                          available_days: enabledDays,
                          weekly_schedule: weeklySchedule,
                          org_id: org.id 
                        })
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error || 'Failed to save calendar')
                      resetForm()
                      await fetchCalendarData()
                      setActiveTab('events')
                      setWizardStep(1)
                    } catch (err: any) {
                      setSaveError(err.message || 'Failed to save calendar')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Save & Publish Calendar</span>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

// --- HIGH-END UPCOMING APPOINTMENTS CALENDAR COMPONENT ---
function AppointmentsCalendarView({ 
  appointments, 
  onRefresh
}: { 
  appointments: Appointment[]
  onRefresh: () => void
}) {
  const { org } = useOrg()
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'cards'>('day')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [selectedDayDate, setSelectedDayDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  // Status & Notes Update States
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesInput, setNotesInput] = useState('')
  const [updating, setUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')

  useEffect(() => {
    if (selectedAppointment) {
      setNotesInput(selectedAppointment.notes || '')
      setEditingNotes(false)
      setUpdateMessage('')
    }
  }, [selectedAppointment])

  const handleUpdateStatus = async (newStatus: 'confirmed' | 'completed' | 'cancelled') => {
    if (!selectedAppointment || !org?.id) return
    setUpdating(true)
    setUpdateMessage('')
    try {
      const res = await fetch('/api/calendar/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAppointment.id,
          org_id: org.id,
          status: newStatus
        })
      })
      if (!res.ok) throw new Error('Failed to update status')
      setSelectedAppointment({ ...selectedAppointment, status: newStatus })
      setUpdateMessage(`Status updated to ${newStatus.toUpperCase()}!`)
      onRefresh()
    } catch (err: any) {
      setUpdateMessage(err.message || 'Update failed')
    } finally {
      setUpdating(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!selectedAppointment || !org?.id) return
    setUpdating(true)
    setUpdateMessage('')
    try {
      const res = await fetch('/api/calendar/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAppointment.id,
          org_id: org.id,
          notes: notesInput
        })
      })
      if (!res.ok) throw new Error('Failed to save notes')
      setSelectedAppointment({ ...selectedAppointment, notes: notesInput })
      setEditingNotes(false)
      setUpdateMessage('Meeting notes saved successfully!')
      onRefresh()
    } catch (err: any) {
      setUpdateMessage(err.message || 'Failed to save notes')
    } finally {
      setUpdating(false)
    }
  }

  // Filter logic
  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = 
      apt.attendee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.attendee_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.attendee_phone?.includes(searchQuery)
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Navigation handlers
  const prevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const goToday = () => {
    setCurrentDate(new Date())
  }

  const prevDay = () => {
    const d = new Date(selectedDayDate + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    setSelectedDayDate(d.toISOString().split('T')[0])
  }

  const nextDay = () => {
    const d = new Date(selectedDayDate + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    setSelectedDayDate(d.toISOString().split('T')[0])
  }

  const goTodayDay = () => {
    setSelectedDayDate(new Date().toISOString().split('T')[0])
  }

  // Calendar Math
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const calendarCells = []
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day)
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-5">
      
      {/* TOOLBAR: SEARCH, FILTERS & VIEW MODE TOGGLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-xl">
        
        {/* LEFT: SEARCH & FILTER */}
        <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search meetings by name, email, or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* RIGHT: VIEW TOGGLE & REFRESH */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'day'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Day View
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'month'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'cards'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              List View
            </button>
          </div>

          <button
            onClick={onRefresh}
            title="Refresh Meetings"
            className="p-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl border border-slate-800 transition-colors text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* DAY VIEW TIMELINE */}
      {viewMode === 'day' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-6">
          
          {/* DAY NAVIGATION HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-black text-white tracking-wide flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-400" />
                <span>{new Date(selectedDayDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredAppointments.filter(a => a.booking_date === selectedDayDate).length} meeting(s) scheduled for this day
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goTodayDay}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-colors"
              >
                Today
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevDay}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors text-xs font-semibold"
                >
                  ◀ Prev Day
                </button>
                <input
                  type="date"
                  value={selectedDayDate}
                  onChange={e => e.target.value && setSelectedDayDate(e.target.value)}
                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  onClick={nextDay}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors text-xs font-semibold"
                >
                  Next Day ▶
                </button>
              </div>
            </div>
          </div>

          {/* DAY HOURLY TIMELINE SLOTS */}
          <div className="space-y-3">
            {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(hourStr => {
              const hourNum = parseInt(hourStr.split(':')[0], 10)
              const hourFormatted = `${hourNum > 12 ? hourNum - 12 : hourNum === 0 ? 12 : hourNum}:00 ${hourNum >= 12 ? 'PM' : 'AM'}`

              // Meetings that start during this hour on selectedDayDate
              const hourMeetings = filteredAppointments.filter(a => {
                if (a.booking_date !== selectedDayDate) return false
                const startHour = parseInt((a.start_time || '').split(':')[0], 10)
                return startHour === hourNum
              })

              return (
                <div key={hourStr} className="flex gap-4 items-start group">
                  <div className="w-20 pt-1 text-right font-mono text-xs font-bold text-slate-400 group-hover:text-emerald-400 transition-colors">
                    {hourFormatted}
                  </div>

                  <div className="flex-1 min-h-[56px] p-3 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl transition-all space-y-2">
                    {hourMeetings.length === 0 ? (
                      <div className="text-[11px] text-slate-600 italic py-0.5">
                        No appointments scheduled
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {hourMeetings.map(apt => (
                          <div
                            key={apt.id}
                            onClick={() => setSelectedAppointment(apt)}
                            className="p-3 bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 rounded-xl cursor-pointer transition-all shadow-md space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-emerald-400" />
                                {apt.attendee_name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                                {apt.status}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-300 flex items-center justify-between font-mono">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {apt.start_time} - {apt.end_time || '30m'}
                              </span>
                              <span className="text-slate-400 text-[10px]">{apt.attendee_phone}</span>
                            </div>

                            {apt.notes && (
                              <div className="text-[10px] text-slate-400 truncate italic">
                                "{apt.notes}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}

      {/* MONTH VIEW GRID */}
      {viewMode === 'month' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          
          {/* MONTH NAVIGATION HEADER */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-black text-white tracking-wide">{monthName}</h2>
              <button
                onClick={goToday}
                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[11px] font-bold transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={prevMonth}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors text-xs font-semibold"
              >
                ◀ Prev
              </button>
              <button
                onClick={nextMonth}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors text-xs font-semibold"
              >
                Next ▶
              </button>
            </div>
          </div>

          {/* DAY NAMES HEADER ROW */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 pb-2 border-b border-slate-800/60">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* CALENDAR CELLS GRID */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((dayNum, idx) => {
              if (dayNum === null) {
                return <div key={`empty-${idx}`} className="h-28 bg-slate-950/30 rounded-2xl border border-slate-900/40" />
              }

              const formattedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              const isToday = formattedDateStr === todayStr

              // Find meetings on this date
              const dayMeetings = filteredAppointments.filter(a => a.booking_date === formattedDateStr)

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => {
                    setSelectedDayDate(formattedDateStr)
                    setViewMode('day')
                  }}
                  className={`h-28 p-2 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer ${
                    isToday
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10 hover:bg-emerald-500/20'
                      : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                          : 'text-slate-300'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {dayMeetings.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {dayMeetings.length}
                      </span>
                    )}
                  </div>

                  {/* MEETING PILLS LIST */}
                  <div className="space-y-1 overflow-y-auto max-h-16 pr-0.5 custom-scrollbar">
                    {dayMeetings.map(apt => (
                      <button
                        key={apt.id}
                        onClick={() => setSelectedAppointment(apt)}
                        className="w-full text-left px-2 py-1 bg-emerald-950/90 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-800/60 rounded-lg text-[10px] font-semibold truncate transition-colors flex items-center justify-between gap-1 shadow-sm"
                      >
                        <span className="truncate">{apt.start_time} {apt.attendee_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}

      {/* CARDS / LIST VIEW */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAppointments.map(apt => (
            <div key={apt.id} className="p-5 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-3 shadow-xl hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-white">{apt.attendee_name}</h4>
                  <p className="text-xs text-slate-400">{apt.attendee_email}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase">
                  {apt.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{apt.booking_date} @ {apt.start_time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{apt.attendee_phone}</span>
                </div>
                {apt.notes && (
                  <div className="p-2 bg-slate-950/60 rounded-xl text-[11px] text-slate-400 border border-slate-800/60 mt-1">
                    "{apt.notes}"
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                {apt.meeting_link && (
                  <a
                    href={apt.meeting_link.startsWith('http') ? apt.meeting_link : `https://${apt.meeting_link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors shadow-md shadow-blue-600/20"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Join Meeting</span>
                  </a>
                )}

                <button
                  onClick={() => setSelectedAppointment(apt)}
                  className="p-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors text-xs"
                  title="View Details"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* APPOINTMENT DETAILS MODAL POPOVER */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Appointment Details</h3>
                <p className="text-xs text-emerald-400 font-semibold">{selectedAppointment.booking_date} @ {selectedAppointment.start_time}</p>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-950 rounded-xl border border-slate-800"
              >
                ✕
              </button>
            </div>

            {updateMessage && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-semibold">
                {updateMessage}
              </div>
            )}

            <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Attendee Name:</span>
                <span className="font-bold text-white">{selectedAppointment.attendee_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Email:</span>
                <span className="font-mono text-slate-200">{selectedAppointment.attendee_email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Phone:</span>
                <span className="font-mono text-emerald-400">{selectedAppointment.attendee_phone}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                  selectedAppointment.status === 'completed'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : selectedAppointment.status === 'cancelled'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {selectedAppointment.status}
                </span>
              </div>

              {/* MEETING NOTES & FOLLOW-UP AGENDA SECTION */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-300 font-bold">Meeting Notes & Summary:</span>
                  {!editingNotes && (
                    <button
                      type="button"
                      onClick={() => setEditingNotes(true)}
                      className="text-[11px] text-emerald-400 hover:underline font-semibold"
                    >
                      {selectedAppointment.notes ? 'Edit Notes' : '+ Add Notes'}
                    </button>
                  )}
                </div>

                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      placeholder="Write notes, agenda, or key outcomes of this meeting..."
                      value={notesInput}
                      onChange={e => setNotesInput(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingNotes(false)}
                        className="px-3 py-1 bg-slate-900 text-slate-400 hover:text-white rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={updating}
                        onClick={handleSaveNotes}
                        className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shadow-md shadow-emerald-500/20"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-300 italic p-2.5 bg-slate-900/90 border border-slate-800/80 rounded-xl text-[11px]">
                    {selectedAppointment.notes || 'No notes added yet. Click "+ Add Notes" to record meeting summary.'}
                  </p>
                )}
              </div>
            </div>

            {/* QUICK STATUS ACTIONS (MARK AS COMPLETED / CANCELLED) */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Update Status:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={updating || selectedAppointment.status === 'completed'}
                  onClick={() => handleUpdateStatus('completed')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedAppointment.status === 'completed'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                >
                  ✓ Completed
                </button>

                <button
                  type="button"
                  disabled={updating || selectedAppointment.status === 'confirmed'}
                  onClick={() => handleUpdateStatus('confirmed')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedAppointment.status === 'confirmed'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-blue-600/10 text-blue-400 border-blue-600/30 hover:bg-blue-600/20'
                  }`}
                >
                  Confirmed
                </button>

                <button
                  type="button"
                  disabled={updating || selectedAppointment.status === 'cancelled'}
                  onClick={() => handleUpdateStatus('cancelled')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedAppointment.status === 'cancelled'
                      ? 'bg-rose-600 text-white border-rose-500'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                  }`}
                >
                  ✕ Cancelled
                </button>
              </div>
            </div>

            {/* JOIN LINK & CLOSE */}
            <div className="flex items-center gap-3 pt-2">
              {selectedAppointment.meeting_link && (
                <a
                  href={selectedAppointment.meeting_link.startsWith('http') ? selectedAppointment.meeting_link : `https://${selectedAppointment.meeting_link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Google Meet Call</span>
                </a>
              )}
              <button
                onClick={() => setSelectedAppointment(null)}
                className="px-4 py-3 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold rounded-2xl text-xs border border-slate-800"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

// --- EVENT CALENDAR CARD WITH EXPANDABLE DETAILS ---
function EventCalendarCard({
  evt,
  copiedId,
  copiedEmbedId,
  onCopyLink,
  onCopyEmbed,
  onDelete
}: {
  evt: EventType
  copiedId: string | null
  copiedEmbedId: string | null
  onCopyLink: (slug: string, id: string) => void
  onCopyEmbed: (slug: string, id: string) => void
  onDelete: (id: string, slug: string, title: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="p-6 bg-slate-900/90 border border-slate-800 rounded-3xl space-y-4 shadow-xl hover:border-slate-700 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <span>{evt.title}</span>
          </h4>
          <p className="text-xs text-emerald-400 font-mono mt-0.5">/book/{evt.slug}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
            {evt.duration_minutes} Mins
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-950 text-slate-300 border border-slate-800 text-[11px] font-semibold capitalize">
            {evt.location_type?.replace('_', ' ') || 'Google Meet'}
          </span>
        </div>
      </div>

      {evt.description && (
        <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60">
          {evt.description}
        </p>
      )}

      {/* Basic Metadata Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Location Details</span>
          <span className="text-slate-200 font-mono truncate block font-medium" title={evt.location_url || 'Not set'}>
            {evt.location_url || 'Auto-generated'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-bold">Timezone & Notice</span>
          <span className="text-slate-200 font-medium block">
            {evt.timezone || 'Asia/Kolkata'} ({evt.min_notice_hours || 4}h notice)
          </span>
        </div>
      </div>

      {/* Expanded Details Section */}
      {expanded && (
        <div className="space-y-3 pt-2 border-t border-slate-800/80 animate-in fade-in duration-150">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Weekly Operating Schedule</h5>
            
            {evt.weekly_schedule ? (
              <div className="space-y-1.5 font-mono text-[11px]">
                {DAYS_LIST.map(d => {
                  const sched = evt.weekly_schedule?.[d.id]
                  if (!sched || !sched.enabled) return null
                  const intervalsStr = sched.intervals?.map(i => `${i.start} - ${i.end}`).join(', ')
                  return (
                    <div key={d.id} className="flex justify-between items-center py-0.5 border-b border-slate-900 last:border-0">
                      <span className="font-bold text-emerald-400 w-16 capitalize">{d.label}:</span>
                      <span className="text-slate-300 font-medium">{intervalsStr || '10:00 - 18:00'}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-slate-300 font-medium">
                Active Days: <span className="text-emerald-400 uppercase font-bold">{evt.available_days?.join(', ') || 'MON, TUE, WED, THU, FRI'}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Buffer Between Calls</span>
              <span className="text-slate-300 font-semibold">{evt.buffer_minutes || 0} Minutes</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Slot Interval</span>
              <span className="text-slate-300 font-semibold">{evt.slot_interval || 30} Minutes</span>
            </div>
            {evt.redirect_url && (
              <div className="col-span-2 pt-1 border-t border-slate-900">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Custom Redirect URL</span>
                <span className="text-emerald-400 font-mono text-[11px] truncate block">{evt.redirect_url}</span>
              </div>
            )}
            {evt.n8n_calendar_webhook_url && (
              <div className="col-span-2 pt-1 border-t border-slate-900">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">n8n Calendar Webhook</span>
                <span className="text-blue-400 font-mono text-[11px] truncate block">{evt.n8n_calendar_webhook_url}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expand / Collapse Details Button */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1"
      >
        <span>{expanded ? 'Hide Full Details ▲' : 'View Full Calendar Details ▼'}</span>
      </button>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onCopyLink(evt.slug, evt.id || '')}
          className="flex-1 py-2.5 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 font-bold rounded-xl text-xs border border-slate-800 transition-colors flex items-center justify-center gap-1.5"
        >
          {copiedId === evt.id ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied Link!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        <button
          onClick={() => onCopyEmbed(evt.slug, evt.id || '')}
          className="py-2.5 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 font-bold rounded-xl text-xs border border-slate-800 transition-colors flex items-center gap-1.5"
        >
          {copiedEmbedId === evt.id ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Code className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>iFrame Code</span>
        </button>

        <a
          href={`/book/${evt.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Preview Booking Page"
          className="p-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl transition-colors flex items-center justify-center"
        >
          <ExternalLink className="w-4 h-4" />
        </a>

        <button
          type="button"
          onClick={() => onDelete(evt.id || '', evt.slug, evt.title)}
          title="Delete Calendar"
          className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-colors flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
