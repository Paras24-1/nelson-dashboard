'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Calendar as CalendarIcon, Clock, Video, MapPin, Phone, User, Mail, MessageSquare, CheckCircle2, ChevronRight, Globe, AlertCircle, ArrowLeft } from 'lucide-react'

export default function PublicBookingPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [eventType, setEventType] = useState<any>(null)
  const [existingApts, setExistingApts] = useState<any[]>([])
  const [error, setError] = useState('')

  // Booking state
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [step, setStep] = useState<'slot' | 'form' | 'confirmed'>('slot')

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [confirmedApt, setConfirmedApt] = useState<any>(null)

  useEffect(() => {
    if (slug) {
      fetchEventData()
    }
  }, [slug])

  const fetchEventData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/calendar/book?slug=${encodeURIComponent(slug)}`)
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Event type not found')
      }
      setEventType(data.eventType)
      setExistingApts(data.appointments || [])

      // Set default selected date to tomorrow or today
      const d = new Date()
      d.setDate(d.getDate() + 1)
      setSelectedDate(d.toISOString().split('T')[0])
    } catch (err: any) {
      setError(err.message || 'Failed to load booking details')
    } finally {
      setLoading(false)
    }
  }

  // Generate available time slots based on start_time, end_time, duration & buffer
  const generateSlots = () => {
    if (!eventType || !selectedDate) return []
    const slots: string[] = []

    const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    const [year, month, day] = selectedDate.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const dayCode = DAY_CODES[dateObj.getDay()]

    const bookedForDate = existingApts.filter(a => a.booking_date === selectedDate).map(a => a.start_time)
    const now = new Date()
    const isToday = selectedDate === now.toISOString().split('T')[0]
    const intervalMinutes = Number(eventType.slot_interval) || 30

    // 1. Check if custom per-day weekly schedule exists
    if (eventType.weekly_schedule && eventType.weekly_schedule[dayCode]) {
      const daySched = eventType.weekly_schedule[dayCode]
      if (!daySched.enabled || !Array.isArray(daySched.intervals)) return []

      for (const inter of daySched.intervals) {
        if (!inter.start || !inter.end) continue
        const [startH, startM] = inter.start.split(':').map(Number)
        const [endH, endM] = inter.end.split(':').map(Number)

        let current = new Date()
        current.setFullYear(year, month - 1, day)
        current.setHours(startH, startM, 0, 0)

        const endBoundary = new Date(current)
        endBoundary.setHours(endH, endM, 0, 0)

        while (current < endBoundary) {
          const hStr = String(current.getHours()).padStart(2, '0')
          const mStr = String(current.getMinutes()).padStart(2, '0')
          const timeSlotStr = `${hStr}:${mStr}`

          const slotTimeToday = new Date()
          slotTimeToday.setHours(current.getHours(), current.getMinutes(), 0, 0)

          if (!bookedForDate.includes(timeSlotStr) && (!isToday || slotTimeToday > now)) {
            if (!slots.includes(timeSlotStr)) {
              slots.push(timeSlotStr)
            }
          }

          current = new Date(current.getTime() + intervalMinutes * 60 * 1000)
        }
      }

      return slots.sort()
    }

    // 2. Fallback: standard available_days check
    const availableDays = Array.isArray(eventType.available_days) && eventType.available_days.length > 0 
      ? eventType.available_days 
      : ['mon', 'tue', 'wed', 'thu', 'fri']

    if (!availableDays.includes(dayCode)) {
      return []
    }

    const [startH, startM] = (eventType.start_time || '10:00').split(':').map(Number)
    const [endH, endM] = (eventType.end_time || '18:00').split(':').map(Number)

    let current = new Date()
    current.setFullYear(year, month - 1, day)
    current.setHours(startH, startM, 0, 0)

    const endBoundary = new Date(current)
    endBoundary.setHours(endH, endM, 0, 0)

    while (current < endBoundary) {
      const hStr = String(current.getHours()).padStart(2, '0')
      const mStr = String(current.getMinutes()).padStart(2, '0')
      const timeSlotStr = `${hStr}:${mStr}`

      const slotTimeToday = new Date()
      slotTimeToday.setHours(current.getHours(), current.getMinutes(), 0, 0)

      if (!bookedForDate.includes(timeSlotStr) && (!isToday || slotTimeToday > now)) {
        slots.push(timeSlotStr)
      }

      current = new Date(current.getTime() + intervalMinutes * 60 * 1000)
    }

    return slots
  }

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate || !selectedSlot || !formData.name || !formData.email || !formData.phone) return

    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/calendar/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type_id: eventType.id,
          org_id: eventType.org_id,
          booking_date: selectedDate,
          start_time: selectedSlot,
          attendee_name: formData.name,
          attendee_email: formData.email,
          attendee_phone: formData.phone,
          notes: formData.notes
        })
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to book appointment')
      }

      setConfirmedApt(data.appointment)

      // Handle redirect URL if present
      if (eventType.redirect_url) {
        const targetUrl = eventType.redirect_url.startsWith('http')
          ? eventType.redirect_url
          : `https://${eventType.redirect_url}`
        window.location.href = targetUrl
        return
      }

      setStep('confirmed')
    } catch (err: any) {
      setError(err.message || 'Failed to complete booking')
    } finally {
      setSubmitting(false)
    }
  }

  const availableSlots = generateSlots()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-emerald-400 font-bold text-sm">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span>Loading booking calendar...</span>
        </div>
      </div>
    )
  }

  if (error && !eventType) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Calendar Not Available</h2>
          <p className="text-xs text-slate-400 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-4xl w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        
        {/* Left Column: Event Meta */}
        <div className="md:col-span-5 p-6 sm:p-8 bg-slate-950/60 border-b md:border-b-0 md:border-r border-slate-800/80 flex flex-col justify-between">
          <div>
            {eventType.organization?.name && (
              <div className="flex items-center gap-2 mb-6">
                {eventType.organization.logo_url ? (
                  <img src={eventType.organization.logo_url} alt="Logo" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">
                    {eventType.organization.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{eventType.organization.name}</span>
              </div>
            )}

            <h1 className="text-2xl font-black text-white tracking-tight mb-3">{eventType.title}</h1>

            <div className="space-y-3 my-6">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{eventType.duration_minutes} Minutes</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-300">
                {eventType.location_type === 'google_meet' && <Video className="w-4 h-4 text-blue-400 shrink-0" />}
                {eventType.location_type === 'zoom' && <Video className="w-4 h-4 text-indigo-400 shrink-0" />}
                {eventType.location_type === 'phone_call' && <Phone className="w-4 h-4 text-emerald-400 shrink-0" />}
                {eventType.location_type === 'in_person' && <MapPin className="w-4 h-4 text-amber-400 shrink-0" />}
                <span className="capitalize font-semibold">{eventType.location_type.replace('_', ' ')}</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-300">
                <Globe className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="font-semibold">{eventType.timezone || 'Asia/Kolkata'}</span>
              </div>
            </div>

            {eventType.description && (
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800/60">
                {eventType.description}
              </p>
            )}
          </div>

          <div className="pt-6 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Powered by VoxAI Scheduler</span>
            <span className="text-emerald-400 font-bold">Verified ✅</span>
          </div>
        </div>

        {/* Right Column: Interaction Steps */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center">

          {/* STEP 1: Select Date & Time Slot */}
          {step === 'slot' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-emerald-400" />
                  Select Date & Time
                </h2>
                <p className="text-xs text-slate-400">Click a date on the calendar to view open slots</p>
              </div>

              {/* Interactive Calendar Date Picker */}
              <DatePickerCalendar
                selectedDate={selectedDate}
                onSelectDate={(dateStr) => {
                  setSelectedDate(dateStr)
                  setSelectedSlot('')
                }}
                eventType={eventType}
              />

              {/* Available Slots Grid */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Time Slots for <span className="text-emerald-400 font-bold">{selectedDate || 'Selected Date'}</span>
                </label>
                {availableSlots.length === 0 ? (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center text-xs text-amber-400">
                    No open slots for this date. Please pick another date on the calendar above.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                    {availableSlots.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                          selectedSlot === slot
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!selectedDate || !selectedSlot}
                onClick={() => setStep('form')}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 font-extrabold rounded-2xl text-xs shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Next: Enter Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Enter Attendee Information */}
          {step === 'form' && (
            <form onSubmit={handleBookSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setStep('slot')}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-white">Your Information</h2>
                  <p className="text-xs text-slate-400">
                    Booking for <span className="text-emerald-400 font-bold">{selectedDate}</span> at <span className="text-emerald-400 font-bold">{selectedSlot}</span>
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone / WhatsApp Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Additional Notes / Agenda (Optional)</label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <textarea
                    rows={2}
                    placeholder="Please share anything that will help prepare for our meeting..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !formData.name || !formData.email || !formData.phone}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black rounded-2xl text-xs shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Confirm & Schedule Meeting</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 3: Booking Confirmed Success Screen */}
          {step === 'confirmed' && confirmedApt && (
            <div className="text-center space-y-5 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-black text-white tracking-tight mb-1">Meeting Confirmed!</h2>
                <p className="text-xs text-slate-400">
                  A confirmation email has been sent to <span className="text-emerald-400 font-mono font-bold">{confirmedApt.attendee_email}</span>
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Date:</span>
                  <span className="font-bold text-white">{confirmedApt.booking_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time:</span>
                  <span className="font-bold text-emerald-400">{confirmedApt.start_time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Attendee:</span>
                  <span className="font-bold text-white">{confirmedApt.attendee_name}</span>
                </div>
              </div>

              {eventType.location_url && (
                <a
                  href={eventType.location_url.startsWith('http') ? eventType.location_url : `https://${eventType.location_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-blue-600/30"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Meeting Link</span>
                </a>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// --- INTERACTIVE CALENDAR DATE PICKER COMPONENT ---
function DatePickerCalendar({
  selectedDate,
  onSelectDate,
  eventType
}: {
  selectedDate: string
  onSelectDate: (dateStr: string) => void
  eventType: any
}) {
  const initialDate = selectedDate ? new Date(selectedDate) : new Date()
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(initialDate)

  const prevMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const year = currentMonthDate.getFullYear()
  const month = currentMonthDate.getMonth()
  const monthName = currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })

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
  const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-xl">
      {/* Month Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <span className="text-xs font-black text-white tracking-wide">{monthName}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 text-xs font-bold"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 text-xs font-bold"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 pb-1">
        <div>Su</div>
        <div>Mo</div>
        <div>Tu</div>
        <div>We</div>
        <div>Th</div>
        <div>Fr</div>
        <div>Sa</div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) {
            return <div key={`empty-${idx}`} className="h-9" />
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          const isPast = dateStr < todayStr
          const isSelected = dateStr === selectedDate

          // Operating day check
          const dateObj = new Date(year, month, dayNum)
          const dayCode = DAY_CODES[dateObj.getDay()]
          
          let isOperating = true
          if (eventType?.weekly_schedule && eventType.weekly_schedule[dayCode]) {
            isOperating = Boolean(eventType.weekly_schedule[dayCode].enabled)
          } else if (Array.isArray(eventType?.available_days)) {
            isOperating = eventType.available_days.includes(dayCode)
          }

          const isDisabled = isPast || !isOperating

          return (
            <button
              key={`day-${dayNum}`}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDate(dateStr)}
              className={`h-9 w-9 mx-auto rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                isSelected
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30 scale-105'
                  : isDisabled
                  ? 'opacity-25 text-slate-600 cursor-not-allowed pointer-events-none'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {dayNum}
            </button>
          )
        })}
      </div>
    </div>
  )
}
