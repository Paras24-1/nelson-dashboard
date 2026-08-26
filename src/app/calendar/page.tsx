'use client'

import { useState, useEffect } from 'react'
import { useOrg } from '@/contexts/OrgContext'
import { 
  Calendar as CalendarIcon, Clock, Video, MapPin, Phone, User, Plus, Code, Copy, Check, 
  Trash2, ExternalLink, Filter, Search, Globe, ShieldAlert, Sparkles, RefreshCw, ChevronRight, ArrowLeft
} from 'lucide-react'

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
  start_time: string
  end_time: string
  timezone: string
  slot_interval: number
  buffer_minutes: number
  min_notice_hours: number
  redirect_url?: string
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
  const { org, profile } = useOrg()
  const [activeTab, setActiveTab] = useState<'appointments' | 'events' | 'create'>('appointments')

  // Feature Flag Gating Check: tenant must have has_calendar enabled (or be owner/admin override if configured)
  const isAllowed = Boolean(org?.has_calendar)

  // Data states
  const [events, setEvents] = useState<EventType[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedEmbedId, setCopiedEmbedId] = useState<string | null>(null)

  // Wizard state for event creation
  const [wizardStep, setWizardStep] = useState<number>(1)
  const [formData, setFormData] = useState<EventType>({
    title: '',
    slug: '',
    description: '',
    duration_minutes: 30,
    location_type: 'google_meet',
    location_url: '',
    available_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
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

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (wizardStep < 4) {
      setWizardStep(prev => prev + 1)
      return
    }
    if (!org?.id) return
    setSaving(true)
    setSaveError('')

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          org_id: org.id
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save event type')

      await fetchCalendarData()
      setActiveTab('events')
      setWizardStep(1)
      setFormData({
        title: '',
        slug: '',
        description: '',
        duration_minutes: 30,
        location_type: 'google_meet',
        location_url: '',
        available_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        start_time: '10:00',
        end_time: '18:00',
        timezone: 'Asia/Kolkata',
        slot_interval: 30,
        buffer_minutes: 10,
        min_notice_hours: 4,
        redirect_url: ''
      })
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event calendar?')) return
    try {
      await fetch(`/api/calendar/events?id=${id}&org_id=${org?.id}`, { method: 'DELETE' })
      fetchCalendarData()
    } catch (e) {}
  }

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm('Are you sure you want to cancel/remove this appointment?')) return
    try {
      await fetch(`/api/calendar/appointments?id=${id}&org_id=${org?.id}`, { method: 'DELETE' })
      fetchCalendarData()
    } catch (e) {}
  }

  const toggleDay = (day: string) => {
    setFormData(prev => {
      const exists = prev.available_days.includes(day)
      return {
        ...prev,
        available_days: exists
          ? prev.available_days.filter(d => d !== day)
          : [...prev.available_days, day]
      }
    })
  }

  // --- UNALLOWED / GATED TENANT PAYWALL VIEW ---
  if (!isAllowed) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Booking Calendar Access Required</h1>
              <p className="text-xs text-slate-400">Feature upgrade required to access scheduling</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full p-8 bg-slate-900/80 border border-slate-800 rounded-3xl text-center space-y-6 shadow-2xl backdrop-blur-xl">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/10">
              <CalendarIcon className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Feature Upgrade Available</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Booking Calendar & Scheduler</h2>
              <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                Allow your leads and clients to schedule meetings directly using custom sharable booking links or embedded website widgets.
              </p>
            </div>

            {/* Features Highlight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center gap-3">
                <Clock className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">Custom Event Types</h4>
                  <p className="text-[11px] text-slate-400">15m, 30m, 60m meetings & working hours</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center gap-3">
                <Video className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">Google Meet / Zoom</h4>
                  <p className="text-[11px] text-slate-400">Instant meeting link generation</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center gap-3">
                <Code className="w-5 h-5 text-purple-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">iFrame Website Embed</h4>
                  <p className="text-[11px] text-slate-400">Embed calendar directly on your site</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center gap-3">
                <Phone className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">WhatsApp Notifications</h4>
                  <p className="text-[11px] text-slate-400">Automated WhatsApp meeting reminders</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="https://wa.me/917015551637?text=Hello%20Admin,%20I%20want%20to%20activate%20the%20Booking%20Calendar%20feature%20for%20my%20organization."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs shadow-xl shadow-emerald-500/20 transition-all scale-100 hover:scale-[1.02]"
              >
                <span>Request Activation from Admin</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- ALLOWED TENANT FULL CALENDAR DASHBOARD ---
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100">
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Booking Calendar & Scheduler</h1>
              <p className="text-xs text-slate-400">Manage client appointment slots and website embeds</p>
            </div>
          </div>
        </div>

      <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">

        {/* Top Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'appointments'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Upcoming Appointments ({appointments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('events')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'events'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Event Calendars ({events.length})</span>
            </button>
          </div>

          <button
            onClick={() => { setActiveTab('create'); setWizardStep(1); }}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Calendar</span>
          </button>
        </div>

        {/* TAB 1: UPCOMING APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-emerald-400" />
              Booked Meetings List
            </h3>

            {loading ? (
              <div className="py-12 flex justify-center text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
              </div>
            ) : appointments.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-3xl">
                <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-300">No appointments scheduled yet</p>
                <p className="text-[11px] text-slate-500 mt-1">Share your calendar booking link with leads to start receiving bookings!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {appointments.map(apt => (
                  <div key={apt.id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 relative group">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{apt.attendee_name}</h4>
                        <p className="text-xs text-emerald-400 font-mono font-semibold">{apt.attendee_phone}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {apt.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>{apt.booking_date} @ <strong className="text-white">{apt.start_time}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{apt.attendee_email}</span>
                      </div>
                      {apt.notes && (
                        <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 mt-1">
                          "{apt.notes}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      {apt.meeting_link && (
                        <a
                          href={apt.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Link</span>
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteAppointment(apt.id)}
                        className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-colors"
                        title="Cancel Appointment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EVENT TYPES LIST */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Active Event Calendars
            </h3>

            {loading ? (
              <div className="py-12 flex justify-center text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-3xl">
                <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-300">No event calendars created yet</p>
                <button
                  onClick={() => { setActiveTab('create'); setWizardStep(1); }}
                  className="mt-3 px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Create First Calendar
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.map(evt => (
                  <div key={evt.id} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-base font-bold text-white">{evt.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">{evt.duration_minutes} mins • {evt.location_type.replace('_', ' ')}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteEvent(evt.id!)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {evt.description && (
                        <p className="text-xs text-slate-400 mt-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                          {evt.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleCopyLink(evt.slug, evt.id!)}
                        className="flex-1 py-2 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        {copiedId === evt.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        <span>{copiedId === evt.id ? 'Copied Link!' : 'Copy Booking Link'}</span>
                      </button>

                      <button
                        onClick={() => handleCopyEmbed(evt.slug, evt.id!)}
                        className="flex-1 py-2 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-purple-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        {copiedEmbedId === evt.id ? <Check className="w-3.5 h-3.5 text-purple-400" /> : <Code className="w-3.5 h-3.5 text-purple-400" />}
                        <span>{copiedEmbedId === evt.id ? 'Copied Embed Code!' : 'Copy Embed Code'}</span>
                      </button>

                      <a
                        href={`/book/${evt.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                        title="Preview Public Booking Page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CREATE EVENT WIZARD (Matching Client Video!) */}
        {activeTab === 'create' && (
          <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            
            {/* Header & Step Indicator */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('events')}
                  className="p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-lg font-bold text-white">Create Booking Calendar</h3>
                  <p className="text-xs text-slate-400">Step {wizardStep} of 4</p>
                </div>
              </div>

              {/* Steps pills */}
              <div className="flex items-center gap-1.5">
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

            <form onSubmit={handleSaveEvent} className="space-y-6">

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
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Location / Meeting Provider</label>
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
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Google Meet / Zoom Link (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://meet.google.com/abc-defg-hij"
                      value={formData.location_url}
                      onChange={e => setFormData({ ...formData, location_url: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">If left blank, a dedicated Google Meet room will be generated automatically upon booking.</p>
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
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white">2. Schedule & Availability</h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">Available Working Days</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'mon', label: 'Mon' },
                        { id: 'tue', label: 'Tue' },
                        { id: 'wed', label: 'Wed' },
                        { id: 'thu', label: 'Thu' },
                        { id: 'fri', label: 'Fri' },
                        { id: 'sat', label: 'Sat' },
                        { id: 'sun', label: 'Sun' }
                      ].map(d => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDay(d.id)}
                          className={`w-11 h-11 rounded-xl text-xs font-extrabold border transition-all ${
                            formData.available_days.includes(d.id)
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                              : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Daily Start Time</label>
                      <input
                        type="time"
                        value={formData.start_time}
                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Daily End Time</label>
                      <input
                        type="time"
                        value={formData.end_time}
                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                  <h4 className="text-sm font-bold text-white">4. Review & Create</h4>

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
                      <span className="text-slate-400">Duration:</span>
                      <span className="font-bold text-white">{formData.duration_minutes} Mins</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Working Hours:</span>
                      <span className="font-bold text-white">{formData.start_time} - {formData.end_time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Available Days:</span>
                      <span className="font-bold text-white uppercase">{formData.available_days.join(', ')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Wizard Navigation Buttons */}
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

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    disabled={!formData.title}
                    onClick={() => setWizardStep(prev => prev + 1)}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
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

            </form>
          </div>
        )}

      </div>
    </div>
  )
}
