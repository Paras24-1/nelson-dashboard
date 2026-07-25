'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Users, 
  MessageSquare, 
  Clock, 
  UserPlus, 
  MessageCircle, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  Award,
  Search,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts'
import { useOrg } from '@/contexts/OrgContext'
import { useRouter } from 'next/navigation'

interface EmployeeStats {
  id: string
  name: string
  email: string
  total_assigned: number
  active: number
  completed: number
}

interface TimelineItem {
  date: string
  count: number
}

interface Stats {
  stage_counts: {
    new: number
    interested: number
    booking: number
    confirmed: number
    completed: number
    cancelled: number
    followup: number
    not_interested: number
    call_done: number
    low_budget: number
    hot_customer: number
  }
  total_conversations: number
  total_assigned: number
  total_unassigned: number
  total_active: number
  total_completed: number
  employees: EmployeeStats[]
  timeline: TimelineItem[]
}

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

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

export const dynamic = 'force-dynamic'

export default function AnalyticsPage() {
  const { profile, loading: authLoading } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login')
    if (!authLoading && profile?.role === 'employee') router.push('/chats')
  }, [profile, authLoading, router])

  if (authLoading || !profile) return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return <AnalyticsContent />
}

function AnalyticsContent() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const { org } = useOrg()

  // Daily Leads Inspector states
  const [inspectorDate, setInspectorDate] = useState(new Date().toISOString().split('T')[0])
  const [inspectorLeads, setInspectorLeads] = useState<any[]>([])
  const [inspectorLoading, setInspectorLoading] = useState(false)
  const [inspectorSearch, setInspectorSearch] = useState('')

  useEffect(() => { fetchStats() }, [])

  const fetchInspectorLeads = async () => {
    if (!org?.id || !inspectorDate) return
    setInspectorLoading(true)
    try {
      const startOfDay = new Date(inspectorDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(inspectorDate)
      endOfDay.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('conversations')
        .select('id, name, phone_number, created_at, stage')
        .eq('org_id', org.id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      setInspectorLeads(data || [])
    } catch (err) {
      console.error('Failed to inspect daily leads:', err)
    } finally {
      setInspectorLoading(false)
    }
  }

  useEffect(() => {
    fetchInspectorLeads()
  }, [inspectorDate, org?.id])

  const filteredInspectorLeads = inspectorLeads.filter(lead => {
    const searchStr = inspectorSearch.toLowerCase()
    const nameStr = (lead.name || '').toLowerCase()
    const phoneStr = (lead.phone_number || '').toLowerCase()
    return nameStr.includes(searchStr) || phoneStr.includes(searchStr)
  })

  const fetchStats = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const headers = { 'Authorization': `Bearer ${token}` }

      const res = await fetch('/api/analytics', { headers })
      if (!res.ok) throw new Error('Failed to fetch analytics')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Loading analytics...</p>
      </div>
    </div>
  )

  if (!stats) return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <p className="text-gray-500 dark:text-gray-400">Failed to load analytics</p>
    </div>
  )

  const chartData = stats.employees.map(emp => ({
    name: emp.name.split(' ')[0],
    assigned: emp.total_assigned,
    active: emp.active,
    completed: emp.completed,
  }))

  const pieData = [
    { name: 'Unassigned', value: stats.total_unassigned },
    ...stats.employees.map(emp => ({ name: emp.name.split(' ')[0], value: emp.total_assigned }))
  ].filter(d => d.value > 0)

  // Stage calculations
  const stageCounts = (stats.stage_counts || {}) as Record<string, number>
  const getCount = (stage: string) => stageCounts[stage] || 0

  const newLeads = getCount('new')
  const engaged = getCount('interested') + getCount('followup') + getCount('hot_customer')
  const booked = getCount('booking') + getCount('call_done')
  const converted = getCount('confirmed') + getCount('completed')

  const cancelled = getCount('cancelled')
  const lowBudget = getCount('low_budget')
  const notInterested = getCount('not_interested')
  const lostCount = cancelled + lowBudget + notInterested

  const baseCount = newLeads || stats.total_conversations || 1
  const engagedRate = Math.round((engaged / baseCount) * 100)
  const bookedRate = Math.round((booked / baseCount) * 100)
  const convertedRate = Math.round((converted / baseCount) * 100)

  const calculateDropOff = (prev: number, curr: number) => {
    if (prev <= 0) return 0
    const diff = prev - curr
    if (diff <= 0) return 0
    return Math.round((diff / prev) * 100)
  }

  const dropoff1 = calculateDropOff(newLeads, engaged)
  const dropoff2 = calculateDropOff(engaged, booked)
  const dropoff3 = calculateDropOff(booked, converted)

  const conversionRate = stats.total_conversations > 0
    ? Math.round((converted / stats.total_conversations) * 100)
    : 0

  const sortedEmployees = [...stats.employees].sort((a, b) => {
    const rateA = a.total_assigned > 0 ? (a.completed / a.total_assigned) : 0
    const rateB = b.total_assigned > 0 ? (b.completed / b.total_assigned) : 0
    if (rateA === rateB) return b.completed - a.completed
    return rateB - rateA
  })

  const getRankBadge = (index: number) => {
    if (index === 0) return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 text-xs font-bold">🥇</span>
    if (index === 1) return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/10 text-slate-400 border border-slate-400/30 text-xs font-bold">🥈</span>
    if (index === 2) return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/10 text-amber-700 border border-amber-700/30 text-xs font-bold">🥉</span>
    return <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-150 dark:bg-gray-800 text-gray-500 text-xs font-semibold">{index + 1}</span>
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <Sidebar />
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Analytics Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{org?.name} — Pipeline efficiency & agent performance</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Row 1: Quick Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            icon={<MessageSquare className="w-5 h-5 animate-pulse text-indigo-500" />} 
            label="Total Conversations" 
            value={stats.total_conversations} 
            description="Total database records sync"
            color="indigo" 
          />
          <StatCard 
            icon={<Users className="w-5 h-5 text-emerald-500" />} 
            label="Assigned Chats" 
            value={stats.total_assigned} 
            description="Managed by active operators"
            color="emerald" 
          />
          <StatCard 
            icon={<Clock className="w-5 h-5 text-amber-500" />} 
            label="Unassigned Queue" 
            value={stats.total_unassigned} 
            description="Awaiting assignment response"
            color="amber" 
          />
        </div>

        {/* Daily Lead Trend Chart */}
        <div className="bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-500" />
                Daily Lead Generation Trend
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Track incoming lead volumes day-by-day over the last 30 days</p>
            </div>
            <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
              Last 30 Days
            </div>
          </div>

          {/* Custom Responsive SVG Chart */}
          <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 pt-4 border-b border-gray-150 dark:border-gray-800">
            {stats.timeline?.map((day, idx) => {
              const maxVal = Math.max(...(stats.timeline?.map(d => d.count) || []), 5)
              const heightPercent = (day.count / maxVal) * 100
              return (
                <div key={idx} className="flex-1 h-full flex flex-col justify-end items-center group relative">
                  {/* Hover tooltip bubble */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div className="bg-gray-950 dark:bg-white text-white dark:text-gray-900 text-[9px] font-bold px-2 py-1 rounded-lg shadow-md whitespace-nowrap">
                      {day.count} leads ({day.date})
                    </div>
                    <div className="w-1.5 h-1.5 bg-gray-950 dark:bg-white rotate-45 -mt-1" />
                  </div>
                  {/* Vertical Bar */}
                  <div
                    style={{ height: `${Math.max(heightPercent, 2)}%` }}
                    className="w-full rounded-t bg-gradient-to-t from-emerald-500/20 to-emerald-500 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer shadow-inner"
                  />
                </div>
              )
            })}
          </div>
          {/* Legend Labels */}
          <div className="flex justify-between text-[9px] font-bold text-gray-400 mt-2 px-1">
            <span>{stats.timeline?.[0]?.date}</span>
            <span>{stats.timeline?.[14]?.date}</span>
            <span>{stats.timeline?.[29]?.date}</span>
          </div>
        </div>

        {/* Row 2: Funnel & Leakage analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Conversion Funnel Box */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 flex flex-col shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Lead Conversion Funnel</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Visualizing the flow of leads from ingestion to final completion</p>
            </div>
            
            <div className="flex-1 flex flex-col justify-center space-y-2 py-4">
              {/* Funnel Step 1: New Leads */}
              <div className="w-full relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-15 group-hover:opacity-30 transition duration-300" />
                <div className="relative bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">New Leads</h4>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Awaiting operator engagement</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-gray-900 dark:text-white">{newLeads}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">100% Base</span>
                  </div>
                </div>
              </div>

              {/* Connector 1 */}
              <FunnelConnector dropoff={dropoff1} />

              {/* Funnel Step 2: Engaged */}
              <div className="w-[90%] mx-auto relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-pink-500 rounded-xl blur opacity-15 group-hover:opacity-30 transition duration-300" />
                <div className="relative bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-500 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Engaged Leads</h4>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Interested / Follow-up / Hot</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-gray-900 dark:text-white">{engaged}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">{engagedRate}% of Base</span>
                  </div>
                </div>
              </div>

              {/* Connector 2 */}
              <FunnelConnector dropoff={dropoff2} />

              {/* Funnel Step 3: Booked */}
              <div className="w-[80%] mx-auto relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl blur opacity-15 group-hover:opacity-30 transition duration-300" />
                <div className="relative bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Booked Leads</h4>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Booking / Call completed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-gray-900 dark:text-white">{booked}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">{bookedRate}% of Base</span>
                  </div>
                </div>
              </div>

              {/* Connector 3 */}
              <FunnelConnector dropoff={dropoff3} />

              {/* Funnel Step 4: Converted */}
              <div className="w-[70%] mx-auto relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur opacity-15 group-hover:opacity-30 transition duration-300" />
                <div className="relative bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Converted Leads</h4>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">Confirmed / Won / Closed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-gray-900 dark:text-white">{converted}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">{convertedRate}% of Base</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Leads Inspector Section */}
            <div className="mt-8 pt-6 border-t border-gray-150 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    Daily Leads Inspector
                    {!inspectorLoading && (
                      <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                        {inspectorLeads.length} {inspectorLeads.length === 1 ? 'lead' : 'leads'}
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-gray-400">Select a date to view all leads acquired on that day</p>
                </div>
                
                {/* Date Picker Input */}
                <input
                  type="date"
                  value={inspectorDate}
                  onChange={e => setInspectorDate(e.target.value)}
                  className="px-3 py-2 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-855 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Search Inside Inspector */}
              {inspectorLeads.length > 0 && (
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter by name or phone..."
                    value={inspectorSearch}
                    onChange={e => setInspectorSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-[11px] text-gray-905 dark:text-white bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-150 dark:border-gray-855 focus:outline-none"
                  />
                </div>
              )}

              {/* Inspector Content */}
              {inspectorLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  Loading leads...
                </div>
              ) : filteredInspectorLeads.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  {inspectorLeads.length > 0 ? 'No matching leads found.' : 'No leads ingested on this date.'}
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-100 dark:divide-gray-800/60">
                  {filteredInspectorLeads.map((lead) => {
                    const stageColor = STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    return (
                      <div key={lead.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {lead.name || `Lead (${lead.phone_number})`}
                          </p>
                          <p className="text-[10px] text-gray-400 block mt-0.5">
                            Phone: {lead.phone_number || 'N/A'} • Received: {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${stageColor}`}>
                            {lead.stage}
                          </span>
                          <Link
                            href={`/chats?phone=${lead.phone_number}`}
                            className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-gray-400 hover:text-emerald-500 transition-colors"
                            title="Open Chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Pipeline Leakage & Health Card */}
          <div className="bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 flex flex-col shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Pipeline Health</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Leakage analysis and conversion ratios</p>
            </div>

            <div className="flex-1 flex flex-col justify-between">
              {/* Circular Progress for Overall Conversion Rate */}
              <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-150 dark:border-gray-800/60 mb-6">
                <div className="relative shrink-0 flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      className="text-gray-200 dark:text-gray-800"
                      strokeWidth="5"
                      stroke="currentColor"
                      fill="transparent"
                      r="24"
                      cx="32"
                      cy="32"
                    />
                    <circle
                      className="text-emerald-500"
                      strokeWidth="5"
                      strokeDasharray={150.8}
                      strokeDashoffset={150.8 - (150.8 * conversionRate) / 100}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="24"
                      cx="32"
                      cy="32"
                    />
                  </svg>
                  <div className="absolute text-sm font-extrabold text-gray-900 dark:text-white">
                    {conversionRate}%
                  </div>
                </div>
                <div>
                  <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Overall Conversion</h5>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Ratio of won deals out of total conversations</p>
                </div>
              </div>

              {/* Dropped Leads Summary */}
              <div className="flex items-center justify-between p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-950/50 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Dropped Leads</h5>
                    <p className="text-[10px] text-rose-500 dark:text-rose-500 mt-0.5">Inactive or non-interested pipeline</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{lostCount}</span>
                </div>
              </div>

              {/* Leakage Breakdown */}
              <div className="space-y-4">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Leakage Reasons</h5>
                <div className="space-y-3">
                  <LeakageBar label="Cancelled Operations" count={cancelled} total={lostCount} color="bg-rose-500" />
                  <LeakageBar label="Low Budget Limits" count={lowBudget} total={lostCount} color="bg-orange-500" />
                  <LeakageBar label="Not Interested / Lost" count={notInterested} total={lostCount} color="bg-slate-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employee Chat Bar Chart */}
          <div className="bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Chats per Employee</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Comparing agent workload, active status, and completions</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-150 dark:stroke-gray-800" stroke="#f3f4f6" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="assigned" fill="#6366f1" radius={[4, 4, 0, 0]} name="Total Assigned" />
                <Bar dataKey="active" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Active" />
                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chat Donut Distribution Chart */}
          <div className="bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Distribution of Chats</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Visual share of conversations allocated across team members</p>
            </div>
            
            <div className="relative flex items-center justify-center my-4 py-2">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie 
                    data={pieData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={65} 
                    outerRadius={85} 
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-950 dark:text-white leading-none">{stats.total_conversations}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">Total Chats</span>
              </div>
            </div>

            {/* Custom Interactive Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {pieData.map((item, index) => (
                <div 
                  key={item.name} 
                  className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/40 p-2 rounded-lg border border-gray-150 dark:border-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-gray-600 dark:text-gray-300 truncate font-semibold">{item.name}</span>
                  <span className="ml-auto font-black text-gray-900 dark:text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 4: Employee Performance Leaderboard */}
        <div className="bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                Team Performance Leaderboard
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ranked by completion rate and active resolution index</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-150 dark:border-gray-800/85">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-850/50">
                  <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Rank</th>
                  <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Employee</th>
                  <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Total Assigned</th>
                  <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Active</th>
                  <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Completed</th>
                  <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Completion Index</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedEmployees.map((emp, index) => {
                  const completionRate = emp.total_assigned > 0
                    ? Math.round((emp.completed / emp.total_assigned) * 100) 
                    : 0
                  
                  return (
                    <tr 
                      key={emp.id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-850/40 transition-colors"
                    >
                      <td className="py-4 px-4 font-bold text-sm">
                        {getRankBadge(index)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold border border-indigo-400/20 shadow-md">
                            {emp.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              {emp.name}
                              {index === 0 && (
                                <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 rounded-full border border-amber-200 dark:border-amber-900/30 flex items-center gap-0.5">
                                  Top Agent <Award className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-100 dark:border-indigo-900/20">{emp.total_assigned}</span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-100 dark:border-amber-900/20">{emp.active}</span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-900/20">{emp.completed}</span>
                      </td>
                      <td className="text-center py-4 px-4">
                        <div className="flex items-center justify-center gap-3">
                          <div className="w-24 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700/50">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700" 
                              style={{ width: `${completionRate}%` }} 
                            />
                          </div>
                          <span className="text-xs font-black text-gray-900 dark:text-white w-8 text-right">{completionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, description, color }: { icon: React.ReactNode; label: string; value: number; description?: string; color: string }) {
  const colorClasses: Record<string, string> = {
    indigo: 'from-indigo-500/10 to-indigo-600/5 text-indigo-500 border-indigo-500/20 shadow-indigo-500/5',
    emerald: 'from-emerald-500/10 to-emerald-600/5 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5',
    amber: 'from-amber-500/10 to-amber-600/5 text-amber-500 border-amber-500/20 shadow-amber-500/5',
  }
  return (
    <div className={`relative overflow-hidden bg-gradient-to-b ${colorClasses[color]} bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 shadow-sm hover:shadow-md transition-all duration-300`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-black text-gray-955 dark:text-white tracking-tight">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center border border-gray-150 dark:border-gray-700 shadow-sm">
          {icon}
        </div>
      </div>
      {description && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {description}
        </div>
      )}
    </div>
  )
}

function FunnelConnector({ dropoff }: { dropoff: number }) {
  return (
    <div className="flex flex-col items-center my-0.5 shrink-0 select-none">
      <div className="w-0.5 h-4 bg-gradient-to-b from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700" />
      <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 rounded-full border border-rose-100 dark:border-rose-900/30">
        ↓ {dropoff}% drop-off
      </span>
      <div className="w-0.5 h-4 bg-gradient-to-b from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-800" />
    </div>
  )
}

function LeakageBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{label}</span>
        <span className="font-bold text-gray-900 dark:text-white">
          {count} <span className="text-[10px] text-gray-400 font-normal">({percentage}%)</span>
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-150/20 dark:border-gray-800">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/95 dark:bg-gray-950/95 backdrop-blur-md border border-gray-800 p-3 rounded-xl shadow-xl text-white text-xs space-y-1.5 pointer-events-none">
        <p className="font-bold text-gray-200 border-b border-gray-800 pb-1 mb-1">{label}</p>
        {payload.map((pld: any) => (
          <div key={pld.name || pld.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color || pld.fill }} />
            <span className="text-gray-400 font-medium">{pld.name}:</span>
            <span className="font-bold text-gray-50">{pld.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}