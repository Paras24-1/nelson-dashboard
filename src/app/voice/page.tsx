'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { useOrg } from '@/contexts/OrgContext'
import { supabase } from '@/lib/supabaseClient'
import WebRTCCallModal from '@/components/WebRTCCallModal'
import { 
  PhoneCall, 
  Activity, 
  Clock, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Loader2,
  Lock,
  Sparkles,
  ArrowRight,
  User,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  Play,
  Pause,
  Trash2,
  Users,
  Phone,
  Upload,
  FileText,
  ChevronUp,
  Coins,
  BarChart2,
  TrendingUp,
  Target,
  Award,
  Mic
} from 'lucide-react'

export const dynamic = 'force-dynamic'

interface CallLog {
  id: string
  from_phone_number: string | null
  to_phone_number: string | null
  duration_seconds: number
  status: string
  cost: number
  created_at: string
  transcript: string | null
  recording_url?: string | null
  agents?: { name: string } | null
}

interface WalletInfo {
  voice_wallet_credits: number
  free_minutes_allowance: number
  free_minutes_used: number
  overage_minutes: number
  overage_rate: number
  credits_consumed: number
  remaining_balance: number
}

interface Stats {
  totalCalls: number
  totalMinutes: number
  minutesLimit: number
  avgDuration: number
  totalCost: number
  wallet?: WalletInfo
}

interface Agent {
  id: string
  name: string
}

interface Campaign {
  id: string
  name: string
  status: string
  total_contacts: number
  completed_contacts: number
  agent_id: string
  agents?: { name: string } | null
}

interface Contact {
  id: string
  name: string
  phone_number: string
  status: string
  duration_seconds: number
}

interface ActiveSimulation {
  agentId: string
  agentName: string
  contactId: string
}

interface VoiceOverviewTabProps {
  loading: boolean
  stats: Stats | null
  percentUsed: number
  timeRange: string
  setTimeRange: (range: string) => void
  search: string
  setSearch: (search: string) => void
  filteredLogs: CallLog[]
  expandedLogId: string | null
  setExpandedLogId: (id: string | null) => void
  logs: CallLog[]
  formatDuration: (seconds: number) => string
  getStatusBadge: (status: string) => React.ReactNode
  fetchDashboardData: () => Promise<void>
}

export default function VoicePage() {
  const { profile, org, loading: authLoading } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login')
  }, [profile, authLoading, router])

  if (authLoading || !profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasAccess = org?.has_voice_ai || false

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50/50 dark:bg-gray-950">
      
      {/* Top Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 shrink-0 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Sidebar />
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-emerald-500 shrink-0" />
            <h1 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              Voice AI Agent
            </h1>
          </div>
        </div>
      </header>

      {/* Main Gated Content */}
      <div className="flex-1 overflow-y-auto">
        {hasAccess ? (
          <VoiceDashboardContent />
        ) : (
          <VoiceUpgradePaywall orgName={org?.name || 'Your Team'} />
        )}
      </div>
    </div>
  )
}

/* Paywall Upgrade Screen */
function VoiceUpgradePaywall({ orgName }: { orgName: string }) {
  const [requestLoading, setRequestLoading] = useState(false)
  const [requested, setRequested] = useState(false)

  const handleRequestUpgrade = () => {
    setRequestLoading(true)
    setTimeout(() => {
      setRequestLoading(false)
      setRequested(true)
      // Open WhatsApp direct link to developer for custom plan upgrade
      window.open('https://wa.me/919831282280?text=Hello!%20I%20want%20to%20upgrade%20and%20activate%20Multilingual%20Voice%20AI%20for%20my%20dashboard%20organization:%20' + encodeURIComponent(orgName), '_blank')
    }, 1200)
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6 relative overflow-hidden bg-gray-50/50 dark:bg-gray-950">
      
      {/* Blurred background mockup of Voice Dashboard */}
      <div className="absolute inset-0 filter blur-md opacity-25 dark:opacity-10 scale-105 pointer-events-none select-none grid grid-cols-3 gap-6 p-8">
        <div className="border border-zinc-800 rounded-2xl h-36 bg-zinc-900" />
        <div className="border border-zinc-800 rounded-2xl h-36 bg-zinc-900" />
        <div className="border border-zinc-800 rounded-2xl h-36 bg-zinc-900" />
        <div className="col-span-3 border border-zinc-800 rounded-2xl h-80 bg-zinc-900" />
      </div>

      <div className="relative w-full max-w-xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6 animate-scale-in">
        
        {/* Glow locked Icon */}
        <div className="relative w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/10 flex items-center justify-center shadow-md">
          <PhoneCall className="w-8 h-8 text-emerald-500 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-gray-900 shadow-sm">
            <Lock className="w-2.5 h-2.5" />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100/20">
            Premium Add-on
          </span>
          <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mt-1">
            Unlock Multilingual Voice AI Autopilots
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
            Elevate {orgName}&apos;s customer acquisition. Connect Twilio/Vobiz phone lines directly to a voice assistant that speaks Hindi, Marathi, and English fluently.
          </p>
        </div>

        {/* Feature list */}
        <div className="w-full max-w-md border border-gray-150 dark:border-gray-850 rounded-2xl bg-gray-50/50 dark:bg-gray-950/20 p-4 space-y-3.5 text-left">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-100/10">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Gemini Multimodal Live API</h4>
              <p className="text-[10px] text-gray-550 dark:text-gray-400 leading-normal font-medium mt-0.5">Bidirectional real-time audio streams with near-zero latency and natural voice cadence.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-500 shrink-0 border border-blue-100/10">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Outbound Auto-Dialer Campaigns</h4>
              <p className="text-[10px] text-gray-550 dark:text-gray-400 leading-normal font-medium mt-0.5">Bulk-dial cold lead lists automatically from your Leads CRM and log results.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-500 shrink-0 border border-purple-100/10">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Smart Sales Employee Handover</h4>
              <p className="text-[10px] text-gray-550 dark:text-gray-400 leading-normal font-medium mt-0.5">Transfers the call live to the assigned sales representative when requested by the customer.</p>
            </div>
          </div>
        </div>

        {/* Pricing tag */}
        <div className="text-xs text-gray-500 dark:text-gray-400 font-bold bg-gray-50 dark:bg-gray-950/40 border border-gray-150 dark:border-gray-850 px-4 py-2.5 rounded-xl flex items-center gap-2">
          <span>Voice Rate:</span>
          <span className="text-emerald-500 font-black">₹3.5 / minute</span>
          <span className="text-[10px] text-gray-400 font-normal">| No setup fee</span>
        </div>

        <button
          onClick={handleRequestUpgrade}
          disabled={requestLoading || requested}
          className="w-full max-w-sm py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
        >
          {requestLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : requested ? (
            'Plan Request Sent!'
          ) : (
            <>
              Request Voice Activation
              <ExternalLink className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/* Unlocked Voice AI Dashboard Content */
function VoiceDashboardContent() {
  const [activeTab, setActiveTab] = useState('overview')
  const [showTestCallModal, setShowTestCallModal] = useState(false)
  const [timeRange, setTimeRange] = useState('7d')
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      // 1. Fetch Stats
      const statsRes = await fetch(`/api/voice/stats?timeRange=${timeRange}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const statsData = await statsRes.json()
      if (statsData.error) throw new Error(statsData.error)
      setStats(statsData)

      // 2. Fetch Call Logs
      const logsRes = await fetch('/api/voice/logs?limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const logsData = await logsRes.json()
      if (logsData.error) throw new Error(logsData.error)
      setLogs(logsData)

    } catch (err) {
      console.error('Failed to fetch Voice Dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const filteredLogs = logs.filter((l: CallLog) =>
    (l.agents?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    l.id.toLowerCase().includes(search.toLowerCase()) ||
    (l.transcript || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.from_phone_number || '').includes(search) ||
    (l.to_phone_number || '').includes(search)
  )

  const percentUsed = stats ? Math.min((stats.totalMinutes / stats.minutesLimit) * 100, 100) : 0

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }

  const getStatusBadge = (status: string) => {
    const lower = status.toLowerCase()
    if (lower === 'completed') return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100/10 text-[10px] font-bold uppercase tracking-wider">
        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Ended
      </span>
    )
    if (lower === 'active' || lower === 'live') return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-455 border border-blue-100/10 text-[10px] font-bold uppercase tracking-wider animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Live
      </span>
    )
    if (lower === 'failed' || lower === 'busy' || lower === 'no-answer') return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-100/10 text-[10px] font-bold uppercase tracking-wider">
        <XCircle className="w-3 h-3 text-red-500" /> {status}
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100/10 text-[10px] font-bold uppercase tracking-wider">
        <AlertTriangle className="w-3 h-3 text-amber-500" /> {status}
      </span>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 select-none">
        <div>
          <span className="text-[10px] font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100/20">
            Realtime Analytics Node
          </span>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-2.5">
            Voice Stream Overview
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Live metrics and transcripts synced from your telecommunication servers.
          </p>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          <button
            onClick={() => setShowTestCallModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm inline-flex items-center gap-1.5"
          >
            <PhoneCall className="w-3.5 h-3.5" /> Test Outbound Call
          </button>
          
          <div className="flex rounded-xl bg-white dark:bg-gray-900 p-1 border border-gray-150 dark:border-gray-855 shadow-sm">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'overview'
                  ? 'bg-gray-50 dark:bg-gray-800 text-emerald-500 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-205'
              }`}
            >
              Overview & Logs
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'campaigns'
                  ? 'bg-gray-50 dark:bg-gray-800 text-emerald-500 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-205'
              }`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'analytics'
                  ? 'bg-gray-50 dark:bg-gray-800 text-emerald-500 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-205'
              }`}
            >
              📊 Campaign Analytics
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <VoiceOverviewTab
          loading={loading}
          stats={stats}
          percentUsed={percentUsed}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          search={search}
          setSearch={setSearch}
          filteredLogs={filteredLogs}
          expandedLogId={expandedLogId}
          setExpandedLogId={setExpandedLogId}
          logs={logs}
          formatDuration={formatDuration}
          getStatusBadge={getStatusBadge}
          fetchDashboardData={fetchDashboardData}
        />
      ) : activeTab === 'campaigns' ? (
        <VoiceCampaignsTab />
      ) : (
        <CampaignAnalyticsTab />
      )}

      {showTestCallModal && (
        <TestCallModal onClose={() => setShowTestCallModal(false)} />
      )}
    </div>
  )
}function VoiceOverviewTab({
  loading,
  stats,
  percentUsed,
  timeRange,
  setTimeRange,
  search,
  setSearch,
  filteredLogs,
  expandedLogId,
  setExpandedLogId,
  logs,
  formatDuration,
  getStatusBadge,
  fetchDashboardData
}: VoiceOverviewTabProps) {
  const { org } = useOrg()

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none">
        {/* Total Calls */}
        <div className="bg-white/60 dark:bg-gray-900/60 border border-gray-150 dark:border-gray-800/80 backdrop-blur-md rounded-2xl p-6 flex flex-col justify-between h-40 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Total Calls</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-955 dark:text-white tracking-tight">
                {loading ? '—' : stats?.totalCalls}
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">calls</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2.5">For filtered range ({timeRange})</p>
          </div>
        </div>

        {/* Minutes Gauge */}
        <div className="bg-white/60 dark:bg-gray-900/60 border border-gray-150 dark:border-gray-800/80 backdrop-blur-md rounded-2xl p-6 flex items-center gap-6 h-40 shadow-sm hover:shadow-md transition-all">
          <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle cx="40" cy="40" r="34" className="stroke-gray-100 dark:stroke-gray-800" strokeWidth="6" fill="transparent" />
              <circle
                cx="40" cy="40" r="34"
                className="stroke-emerald-500"
                strokeWidth="6" fill="transparent"
                strokeDasharray={213.6}
                strokeDashoffset={loading ? 213.6 : 213.6 - (213.6 * percentUsed) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                {loading ? '—' : `${Math.round(percentUsed)}%`}
              </span>
            </div>
          </div>
          <div className="flex-grow flex flex-col justify-between py-1 h-full">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">Minutes Used</span>
              <span className="text-2xl font-extrabold text-gray-955 dark:text-white block mt-1 tracking-tight">
                {loading ? '—' : stats?.totalMinutes.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-extrabold">
              {stats && stats.totalMinutes > stats.minutesLimit ? (
                <span className="text-rose-500 font-extrabold">
                  {Math.round(stats.totalMinutes - stats.minutesLimit)} min overage
                </span>
              ) : (
                <>of <span className="text-gray-700 dark:text-gray-300 font-black">{stats?.minutesLimit ?? 100}</span> free min limit</>
              )}
            </div>
          </div>
        </div>

        {/* Avg Call Duration */}
        <div className="bg-white/60 dark:bg-gray-900/60 border border-gray-150 dark:border-gray-800/80 backdrop-blur-md rounded-2xl p-6 flex flex-col justify-between h-40 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Avg Call Duration</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-gray-955 dark:text-white tracking-tight">
              {loading ? '—' : stats ? formatDuration(stats.avgDuration) : '—'}
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2.5">per completed session</p>
          </div>
        </div>

        {/* AI Credits Wallet */}
        <div className="bg-white/60 dark:bg-gray-900/60 border border-gray-150 dark:border-gray-800/80 backdrop-blur-md rounded-2xl p-6 flex flex-col justify-between h-40 shadow-sm hover:shadow-md transition-all animate-scale-in">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">AI Credits Wallet</span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-955 dark:text-white tracking-tight">
                {loading ? '—' : `₹${stats?.wallet?.remaining_balance?.toFixed(2) ?? '0.00'}`}
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">INR</span>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                {loading ? '—' : stats?.wallet && stats.wallet.remaining_balance > 0 ? (
                  `~${(stats.wallet.remaining_balance / 3.5).toFixed(1)} mins left`
                ) : (
                  'No credits'
                )}
              </span>
              <button
                onClick={() => {
                  const orgName = org?.name || 'My Organization';
                  window.open(`https://wa.me/919831282280?text=Hello!%20I%20want%20to%20add%20credits%20to%20my%20Voice%20AI%20Wallet%20for%20organization%3A%20${encodeURIComponent(orgName)}`, '_blank');
                }}
                className="px-2.5 py-1 text-[9px] font-extrabold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-md transition-all uppercase tracking-wider cursor-pointer"
              >
                Top Up
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Call History Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 select-none">
          <div>
            <h2 className="text-sm font-extrabold text-gray-955 dark:text-white tracking-tight uppercase tracking-wide">Call History</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Historical records for outbound & inbound dialogs</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl bg-white dark:bg-gray-900 p-1 border border-gray-150 dark:border-gray-800 shadow-sm">
              {['24h', '7d', '30d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${timeRange === r ? 'bg-gray-50 dark:bg-gray-800 text-emerald-500 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={fetchDashboardData}
              className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 hover:border-gray-250 dark:hover:border-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-all flex items-center gap-2 text-xs font-bold shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>
            <div className="w-full sm:max-w-xs relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by phone, status, transcript..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-850 dark:text-gray-250 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="border border-gray-150 dark:border-gray-800/80 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center select-none text-gray-400">
              <PhoneCall className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-xs font-bold">No call history matches your filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-150 dark:border-gray-850 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 bg-gray-50/50 dark:bg-gray-955/20 select-none">
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Time</th>
                    <th className="px-5 py-3.5">From</th>
                    <th className="px-5 py-3.5">To</th>
                    <th className="px-5 py-3.5">Agent</th>
                    <th className="px-5 py-3.5">Duration</th>
                    <th className="px-5 py-3.5">Cost</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-gray-855 text-xs text-gray-700 dark:text-gray-300">
                  {filteredLogs.map((log: CallLog) => {
                    const isExpanded = expandedLogId === log.id
                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-gray-50/30 dark:hover:bg-gray-850/20 transition-all">
                          <td className="px-5 py-3.5 whitespace-nowrap align-middle">
                            {getStatusBadge(log.status)}
                          </td>
                          <td className="px-5 py-3.5 align-middle whitespace-nowrap">
                            {log.created_at ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">
                                  {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                                  {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-medium font-mono text-[11px] align-middle">
                            {log.from_phone_number || 'Inbound (Virtual)'}
                          </td>
                          <td className="px-5 py-3.5 font-medium font-mono text-[11px] align-middle">
                            {log.to_phone_number || 'Direct Dial'}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-gray-800 dark:text-gray-200 align-middle">
                            {log.agents?.name || 'Default Bot'}
                          </td>
                          <td className="px-5 py-3.5 font-semibold align-middle">
                            {formatDuration(log.duration_seconds)}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400 align-middle">
                            {log.cost > 0 ? `₹${log.cost.toFixed(2)}` : '₹0.00'}
                          </td>
                          <td className="px-5 py-3.5 text-right align-middle select-none">
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="p-1 text-gray-400 hover:text-emerald-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors inline-flex items-center gap-1 font-bold text-[10px] uppercase tracking-wide border border-transparent hover:border-gray-150"
                            >
                              Transcript
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Transcript Panel Modal */}
      {expandedLogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm select-none">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-850 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-5 border-b border-gray-150 dark:border-gray-855 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-gray-955 dark:text-white tracking-tight">Call Audio Transcript</h3>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Session ID: {expandedLogId}</p>
              </div>
              <button 
                onClick={() => setExpandedLogId(null)}
                className="p-1.5 rounded-xl border border-gray-250 dark:border-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Audio Recording Player */}
            {(() => {
              const log = logs.find((l: CallLog) => l.id === expandedLogId);
              if (log?.recording_url) {
                return (
                  <div className="p-5 border-b border-gray-150 dark:border-gray-855 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                      🎧 Play Call Recording
                    </span>
                    <audio
                      src={`/api/voice/recordings/play?url=${encodeURIComponent(log.recording_url)}`}
                      controls
                      className="w-full h-10 outline-none rounded-xl border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm"
                    />
                  </div>
                );
              }
              const st = log?.status?.toLowerCase() || '';
              const isUnanswered = st === 'no-answer' || st === 'no_answer' || st === 'noanswer';
              const isFailed = st === 'failed' || st === 'busy' || st === 'canceled';
              const emoji = isUnanswered ? '📵' : isFailed ? '❌' : '🎙️';
              const reason = isUnanswered
                ? 'Call was not answered — no recording available'
                : isFailed
                ? 'Call failed to connect — no recording available'
                : 'Recording will appear here once the call completes';
              return (
                <div className="p-4 border-b border-gray-150 dark:border-gray-855 bg-gray-50/30 dark:bg-gray-900/30 flex items-center justify-center gap-2">
                  <span className="text-base">{emoji}</span>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {reason}
                  </span>
                </div>
              );
            })()}

            {/* Transcript Body */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50/20 dark:bg-gray-955/10">
              {(() => {
                const log = logs.find((l: CallLog) => l.id === expandedLogId);
                return log?.transcript ? (
                  <div className="text-xs leading-relaxed space-y-3 whitespace-pre-wrap font-medium text-gray-700 dark:text-gray-300">
                    {log.transcript}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 select-none">
                    <Activity className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-xs font-bold">No audio transcript was captured for this call.</p>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-150 dark:border-gray-855 bg-gray-50 dark:bg-gray-900 flex justify-end">
              <button
                type="button"
                onClick={() => setExpandedLogId(null)}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
              >
                Close Transcript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VoiceCampaignsTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignContacts, setCampaignContacts] = useState<Record<string, Contact[]>>({});
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New Campaign Form State
  const [newCampaignName, setNewCampaignName] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [csvContacts, setCsvContacts] = useState<{ name: string; phone_number: string }[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");

  // Interactive Call Simulation State
  const [activeSimulation, setActiveSimulation] = useState<ActiveSimulation | null>(null);

  // CSV Drag and Drop state
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/voice/agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAgents(data || []);
      if (data && data.length > 0) {
        setSelectedAgentId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching agents:", err);
    }
  }, []);

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/voice/campaigns', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCampaigns(data || []);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch contacts for expanded campaign
  const fetchCampaignContacts = useCallback(async (campaignId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch(`/api/voice/campaigns/contacts?campaignId=${campaignId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCampaignContacts(prev => ({
        ...prev,
        [campaignId]: data || []
      }));
    } catch (err) {
      console.error("Error fetching campaign contacts:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAgents();
    fetchCampaigns();
  }, [fetchAgents, fetchCampaigns]);

  // Auto-fetch contacts if a campaign is expanded
  useEffect(() => {
    if (expandedCampaignId) {
      fetchCampaignContacts(expandedCampaignId);
    }
  }, [expandedCampaignId, fetchCampaignContacts]);

  // Real-time polling when a campaign is running
  useEffect(() => {
    const isAnyCampaignRunning = campaigns.some(c => c.status === "running");
    if (!isAnyCampaignRunning) return;

    const interval = setInterval(() => {
      fetchCampaigns();
      if (expandedCampaignId) {
        fetchCampaignContacts(expandedCampaignId);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [campaigns, expandedCampaignId, fetchCampaigns, fetchCampaignContacts]);

  // Toggle expand campaign details
  const toggleExpandCampaign = (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
    } else {
      setExpandedCampaignId(campaignId);
    }
  };

  // CSV Drag & Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const parseCSVText = (text: string) => {
    setCsvError("");
    const lines = text.split(/\r?\n/);
    const parsed: { name: string; phone_number: string }[] = [];

    if (lines.length === 0) {
      setCsvError("The file is empty.");
      setCsvContacts([]);
      return;
    }

    const firstLine = lines[0];
    let delimiter = ",";
    if (firstLine.includes(";")) delimiter = ";";
    else if (firstLine.includes("\t")) delimiter = "\t";

    const rows = lines
      .map((line: string) => {
        return line.split(delimiter).map((cell: string) => cell.replace(/^['"]|['"]$/g, "").trim());
      })
      .filter((row: string[]) => row.length > 0 && row.some((cell: string) => cell !== ""));

    if (rows.length === 0) {
      setCsvError("No readable content found in the file.");
      setCsvContacts([]);
      return;
    }

    let nameColIndex = 0;
    let phoneColIndex = 1;
    let hasHeader = false;

    const firstRow = rows[0];
    const isHeaderRow = firstRow.some((cell: string) => {
      const c = cell.toLowerCase();
      return c.includes("name") || c.includes("phone") || c.includes("number") || c.includes("contact") || c.includes("mobile");
    });

    if (isHeaderRow) {
      hasHeader = true;
      firstRow.forEach((cell: string, idx: number) => {
        const c = cell.toLowerCase();
        if (c.includes("phone") || c.includes("number") || c.includes("mobile") || c.includes("tel") || c.includes("contact")) {
          phoneColIndex = idx;
        } else if (c.includes("name") || c.includes("first") || c.includes("last") || c.includes("user") || c.includes("person")) {
          nameColIndex = idx;
        }
      });
    } else {
      let foundPhoneIdx = -1;
      let foundNameIdx = -1;

      firstRow.forEach((cell: string, idx: number) => {
        const digits = cell.replace(/[^\d]/g, "");
        if (digits.length >= 7) {
          foundPhoneIdx = idx;
        } else if (cell.length > 0 && foundNameIdx === -1) {
          foundNameIdx = idx;
        }
      });

      if (foundPhoneIdx !== -1) {
        phoneColIndex = foundPhoneIdx;
        nameColIndex = foundNameIdx !== -1 ? foundNameIdx : (foundPhoneIdx === 0 ? 1 : 0);
      }
    }

    const dataStartIdx = hasHeader ? 1 : 0;
    for (let i = dataStartIdx; i < rows.length; i++) {
      const row = rows[i];
      if (row.length <= Math.max(nameColIndex, phoneColIndex)) continue;

      const name = row[nameColIndex] || `Contact ${i + 1}`;
      const phone = row[phoneColIndex] || "";

      const cleanPhone = phone.replace(/[^\d+]/g, "");
      if (cleanPhone.length >= 7) {
        parsed.push({ name, phone_number: phone });
      }
    }

    if (parsed.length === 0) {
      setCsvError("Could not find any rows with valid phone numbers (minimum 7 digits). Please check your file format.");
      setCsvContacts([]);
    } else {
      setCsvContacts(parsed);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
      if (isCsv) {
        setCsvFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof event.target?.result === 'string') {
            parseCSVText(event.target.result);
          }
        };
        reader.readAsText(file);
      } else {
        setCsvError("Invalid file type. Please upload a .csv file.");
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
      if (isCsv) {
        setCsvFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof event.target?.result === 'string') {
            parseCSVText(event.target.result);
          }
        };
        reader.readAsText(file);
      } else {
        setCsvError("Invalid file type. Please select a .csv file.");
      }
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName || !selectedAgentId || csvContacts.length === 0) return;

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/voice/campaigns', {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCampaignName,
          agentId: selectedAgentId,
          contacts: csvContacts
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Reset
      setNewCampaignName("");
      setCsvContacts([]);
      setCsvFileName("");
      fetchCampaigns();
    } catch (err: any) {
      console.error("Failed to create campaign:", err);
      alert("Error creating campaign: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const response = await fetch("/api/voice/campaigns/start", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ campaignId })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to start campaign");
      }

      await fetchCampaigns();
    } catch (err: any) {
      console.error("Failed to start campaign:", err);
      alert("Failed to start campaign: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const response = await fetch("/api/voice/campaigns/pause", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ campaignId })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to pause campaign");
      }

      await fetchCampaigns();
    } catch (err: any) {
      console.error("Failed to pause campaign:", err);
      alert("Failed to pause campaign: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign? This will delete all campaign contacts and progress records.")) {
      return;
    }

    setActionLoading(campaignId);
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const response = await fetch(`/api/voice/campaigns?id=${campaignId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to delete campaign");
      }

      await fetchCampaigns();
      if (expandedCampaignId === campaignId) {
        setExpandedCampaignId(null);
      }
    } catch (err: any) {
      console.error("Failed to delete campaign:", err);
      alert("Failed to delete campaign: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Grid: Creator & Active Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Creator panel */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white/60 dark:bg-gray-900/60 border border-gray-150 dark:border-gray-800/85 backdrop-blur-md rounded-2xl p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-extrabold text-gray-955 dark:text-white tracking-tight flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-500" />
              Launch New Campaign
            </h2>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              {/* Campaign name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Real Estate Follow-up"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Agent selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">Select Dialing Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-955 text-xs text-gray-750 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {agents.length === 0 ? (
                    <option value="">No voice agents available</option>
                  ) : (
                    agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* CSV Upload Area */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-405 block">Upload Contact List (CSV)</label>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    dragActive
                      ? "border-emerald-500 bg-emerald-500/5"
                      : "border-gray-205 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-gray-950/20"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileInput}
                  />

                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  
                  {csvFileName ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-emerald-500">{csvFileName}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{csvContacts.length} contacts parsed</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-650 dark:text-gray-305 font-bold">Drag & drop CSV file here</p>
                      <p className="text-[10px] text-gray-405 font-medium mt-0.5">or click to browse local files</p>
                    </div>
                  )}
                </div>

                {csvError && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 bg-rose-50 dark:bg-rose-955/20 p-2 rounded-lg border border-rose-100/10">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{csvError}</span>
                  </p>
                )}

                <div className="rounded-xl bg-gray-50 dark:bg-gray-950/40 p-3.5 border border-gray-150 dark:border-gray-850 text-[10px] font-mono text-gray-405 leading-relaxed mt-2.5">
                  <span className="text-gray-500 dark:text-gray-305 block font-bold mb-1">Expected Format:</span>
                  name, phone_number<br />
                  John Doe, +919831282280<br />
                  Jane Smith, +918360599157
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={creating || csvContacts.length === 0 || !newCampaignName}
                className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Create Campaign</span>
              </button>
            </form>
          </div>
        </div>

        {/* Campaign Lists */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-sm font-extrabold text-gray-955 dark:text-white tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Active Campaigns
          </h2>

          {loading ? (
            <div className="bg-white/60 dark:bg-gray-900/60 border border-gray-150 dark:border-gray-800/80 rounded-2xl p-12 text-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
              <p className="text-xs font-mono text-gray-400">Loading dialing campaigns...</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white/60 dark:bg-gray-900/60 border border-gray-150 dark:border-gray-800/80 rounded-2xl p-16 text-center space-y-3">
              <PhoneCall className="w-10 h-10 text-gray-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300">No campaigns found</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                  Create an outbound calling campaign using the form on the left. You can then simulate browser WebRTC calls.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => {
                const isExpanded = expandedCampaignId === campaign.id;
                const progressPercent = campaign.total_contacts 
                  ? Math.round((campaign.completed_contacts || 0) / campaign.total_contacts * 100) 
                  : 0;

                return (
                  <div
                    key={campaign.id}
                    className={`border transition-all duration-200 overflow-hidden rounded-2xl ${
                      isExpanded
                        ? "border-emerald-500/30 bg-gradient-to-b from-white/80 to-emerald-50/5 dark:from-gray-900/80 dark:to-emerald-950/5"
                        : "border-gray-150 dark:border-gray-850 hover:border-gray-200 dark:hover:border-gray-800 bg-white/60 dark:bg-gray-900/60"
                    }`}
                  >
                    {/* Header Row */}
                    <div
                      onClick={() => toggleExpandCampaign(campaign.id)}
                      className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-gray-955 dark:text-white text-sm">{campaign.name}</span>
                          {campaign.status === "running" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-mono text-[9px] uppercase tracking-wider animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> running
                            </span>
                          ) : campaign.status === "paused" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-555 dark:text-amber-400 font-mono text-[9px] uppercase tracking-wider">
                              paused
                            </span>
                          ) : campaign.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-105 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-404 font-mono text-[9px] uppercase tracking-wider">
                              completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-955 border border-gray-150 dark:border-gray-850 text-gray-400 font-mono text-[9px] uppercase tracking-wider">
                              draft
                            </span>
                          )}
                        </div>

                        {/* Subtitle Info */}
                        <div className="flex items-center gap-4 text-[11px] text-gray-400 font-mono font-medium">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {campaign.total_contacts} Contacts
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                            Agent: {campaign.agents?.name || "Unknown"}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar & Buttons */}
                      <div className="flex items-center gap-6 sm:justify-end">
                        {/* Progress Meter */}
                        <div className="w-36 hidden sm:block space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono text-gray-405">
                            <span>Progress</span>
                            <span>{campaign.completed_contacts}/{campaign.total_contacts}</span>
                          </div>
                          <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-450 rounded-full"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {campaign.status === "running" ? (
                            <button
                              onClick={() => handlePauseCampaign(campaign.id)}
                              disabled={actionLoading === campaign.id}
                              className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-555 dark:text-amber-400 transition-colors cursor-pointer"
                              title="Pause Campaign"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartCampaign(campaign.id)}
                              disabled={actionLoading === campaign.id || campaign.status === "completed"}
                              className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              title="Start Campaign"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteCampaign(campaign.id)}
                            disabled={actionLoading === campaign.id}
                            className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="p-1 text-gray-400 hover:text-gray-600">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar for Mobile */}
                    <div className="px-5 pb-4 sm:hidden">
                      <div className="h-1 bg-gray-150 dark:bg-gray-850 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-450 rounded-full"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Expanded Details Table */}
                    {isExpanded && (
                      <div className="border-t border-gray-150 dark:border-gray-855 bg-gray-50/20 dark:bg-gray-955/10 animate-in slide-in-from-top-4 duration-200">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="bg-gray-50/50 dark:bg-gray-955/40 border-b border-gray-150 dark:border-gray-850 text-[10px] font-mono text-gray-450 uppercase tracking-wider">
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Phone Number</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4 text-right">Interactive Simulation</th>
                              </tr>
                            </thead>
                             <tbody className="divide-y divide-gray-150/40 dark:divide-gray-850/40 font-mono">
                              {(() => {
                                const contacts = campaignContacts[campaign.id];
                                if (!contacts) {
                                  return (
                                    <tr>
                                      <td colSpan={5} className="px-6 py-8 text-center text-gray-450">
                                        <Loader2 className="w-4 h-4 animate-spin text-emerald-500 mx-auto mb-2" />
                                        Loading contacts...
                                      </td>
                                    </tr>
                                  );
                                }
                                if (contacts.length === 0) {
                                  return (
                                    <tr>
                                      <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                        No contacts registered.
                                      </td>
                                    </tr>
                                  );
                                }
                                return contacts.map((contact: Contact) => (
                                  <tr key={contact.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-850/10 transition-colors">
                                    <td className="px-6 py-3.5 font-sans font-semibold text-gray-805 dark:text-gray-200">
                                      {contact.name}
                                    </td>
                                    <td className="px-6 py-3.5 text-gray-500 dark:text-gray-400">
                                      {contact.phone_number}
                                    </td>
                                    <td className="px-6 py-3.5">
                                      {contact.status === "completed" ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100/10 text-[9px] uppercase">
                                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-505" /> Done
                                        </span>
                                      ) : contact.status === "dialing" ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] uppercase animate-pulse">
                                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Dialing
                                        </span>
                                      ) : contact.status === "answered" ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] uppercase animate-pulse">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> active
                                        </span>
                                      ) : contact.status === "failed" ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-455 border border-rose-100/10 text-[9px] uppercase">
                                          <XCircle className="w-2.5 h-2.5" /> Failed
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-955 border border-gray-150 dark:border-gray-850 text-gray-400 text-[9px] uppercase">
                                          {contact.status}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-6 py-3.5 text-gray-500">
                                      {contact.duration_seconds > 0 ? `${contact.duration_seconds}s` : "--"}
                                    </td>
                                    <td className="px-6 py-3.5 text-right">
                                      <button
                                        onClick={() =>
                                          setActiveSimulation({
                                            agentId: campaign.agent_id,
                                            agentName: campaign.agents?.name || "AI Agent",
                                            contactId: contact.id
                                          })
                                        }
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-955 hover:bg-gray-100 dark:hover:bg-gray-900 border border-gray-200 dark:border-gray-850 hover:border-gray-250 dark:hover:border-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-404 transition-colors font-bold text-[10px] cursor-pointer"
                                      >
                                        <Phone className="w-3.5 h-3.5 text-emerald-505" />
                                        Simulate Call
                                      </button>
                                    </td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Call Simulation Modal */}
      {activeSimulation && (
        <WebRTCCallModal
          agentId={activeSimulation.agentId}
          agentName={activeSimulation.agentName}
          contactId={activeSimulation.contactId}
          onClose={() => {
            setActiveSimulation(null);
            fetchCampaigns();
            if (expandedCampaignId) {
              fetchCampaignContacts(expandedCampaignId);
            }
          }}
        />
      )}
    </div>
  );
}

interface TestCallModalProps {
  onClose: () => void
}

function TestCallModal({ onClose }: TestCallModalProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        const res = await fetch('/api/voice/agents', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAgents(data || []);
        if (data && data.length > 0) {
          setSelectedAgentId(data[0].id);
        }
      } catch (err: any) {
        console.error("Error loading agents:", err);
        setError(err.message || 'Failed to load voice agents');
      }
    };
    loadAgents();
  }, []);

  const handleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !phoneNumber) return;
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      const res = await fetch('/api/voice/test-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ agentId: selectedAgentId, phoneNumber })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger test call');
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Call failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm select-none">
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-855 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-5 border-b border-gray-150 dark:border-gray-855 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-gray-955 dark:text-white tracking-tight">Test Outbound Call</h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Test your Voice AI Agent immediately</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl border border-gray-250 dark:border-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCall} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-bold">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-3.5 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-green-600 dark:text-green-400 text-xs font-bold">
              🎉 Test call initiated! Your agent will dial the number shortly.
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Select Voice Agent</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              required
              className="w-full px-4 py-3 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="" disabled>-- Select Agent --</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 919876543210"
              required
              className="w-full px-4 py-3 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-250 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-500 rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedAgentId || !phoneNumber}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Dialing...
                </>
              ) : (
                <>
                  <PhoneCall className="w-3.5 h-3.5" /> Call Now
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Campaign Analytics Tab
───────────────────────────────────────────────────────────── */
interface CampaignAnalytic {
  id: string
  name: string
  status: string
  agent_name: string
  created_at: string
  total_contacts: number
  completed_contacts: number
  failed_contacts: number
  pending_contacts: number
  in_progress_contacts: number
  total_calls: number
  answered_calls: number
  answer_rate: number
  completion_rate: number
  total_duration_seconds: number
  avg_duration_seconds: number
  total_cost: number
  recordings_available: number
}

function CampaignAnalyticsTab() {
  const [analytics, setAnalytics] = useState<CampaignAnalytic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/voice/campaigns/analytics', {
        headers,
        credentials: 'include',
        cache: 'no-store'
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAnalytics(data || [])
      if (data?.length > 0 && !selectedId) setSelectedId(data[0].id)
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => { fetchAnalytics() }, [])

  const fmtDur = (s: number) => {
    if (!s) return '0s'
    const m = Math.floor(s / 60), sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  const statusColor = (s: string) => {
    if (s === 'completed') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400'
    if (s === 'running') return 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400'
    if (s === 'draft') return 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400'
    if (s === 'paused') return 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400'
    return 'text-gray-500 bg-gray-100 dark:bg-gray-800'
  }

  const selected = analytics.find(a => a.id === selectedId)

  // Summary totals across all campaigns
  const totals = analytics.reduce((acc, a) => ({
    contacts: acc.contacts + a.total_contacts,
    calls: acc.calls + a.total_calls,
    cost: acc.cost + a.total_cost,
    duration: acc.duration + a.total_duration_seconds,
    answered: acc.answered + a.answered_calls,
  }), { contacts: 0, calls: 0, cost: 0, duration: 0, answered: 0 })

  const overallAnswerRate = totals.calls > 0 ? Math.round((totals.answered / totals.calls) * 100) : 0

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center py-20 text-red-500 text-sm">{error}</div>
  )

  if (analytics.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
      <BarChart2 className="w-10 h-10 opacity-20" />
      <p className="text-sm font-bold">No campaign data yet</p>
      <p className="text-xs">Create and run a campaign to see analytics here.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Campaigns', value: analytics.length, icon: <Target className="w-4 h-4" />, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/30' },
          { label: 'Total Contacts', value: totals.contacts.toLocaleString(), icon: <Users className="w-4 h-4" />, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
          { label: 'Overall Answer Rate', value: `${overallAnswerRate}%`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'Total Spend', value: `₹${totals.cost.toFixed(2)}`, icon: <Coins className="w-4 h-4" />, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 flex items-start gap-3 shadow-sm">
            <div className={`p-2 rounded-xl ${card.bg} ${card.color}`}>{card.icon}</div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{card.label}</p>
              <p className={`text-xl font-extrabold ${card.color} mt-0.5`}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Campaign List ── */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500">Campaigns</h3>
            <button onClick={fetchAnalytics} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[520px] overflow-y-auto">
            {analytics.map(camp => (
              <button
                key={camp.id}
                onClick={() => setSelectedId(camp.id)}
                className={`w-full text-left p-4 transition-all hover:bg-gray-50 dark:hover:bg-gray-850 ${selectedId === camp.id ? 'bg-emerald-50 dark:bg-emerald-950/20 border-l-2 border-emerald-500' : 'border-l-2 border-transparent'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{camp.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{camp.agent_name}</p>
                  </div>
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${statusColor(camp.status)}`}>
                    {camp.status}
                  </span>
                </div>
                {/* Mini progress bar */}
                <div className="mt-2.5">
                  <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                    <span>{camp.completed_contacts}/{camp.total_contacts} done</span>
                    <span>{camp.completion_rate}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${camp.completion_rate}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Detailed Analytics Panel ── */}
        {selected ? (
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-gray-900 dark:text-white">{selected.name}</h2>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Agent: <span className="font-bold text-gray-600 dark:text-gray-300">{selected.agent_name}</span>
                    &nbsp;·&nbsp;Created: {new Date(selected.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full ${statusColor(selected.status)}`}>
                  {selected.status}
                </span>
              </div>

              {/* KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {[
                  { label: 'Answer Rate', value: `${selected.answer_rate}%`, sub: `${selected.answered_calls} answered`, color: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Completion', value: `${selected.completion_rate}%`, sub: `${selected.completed_contacts}/${selected.total_contacts}`, color: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Avg Duration', value: fmtDur(selected.avg_duration_seconds), sub: `Total: ${fmtDur(selected.total_duration_seconds)}`, color: 'text-violet-600 dark:text-violet-400' },
                  { label: 'Total Cost', value: `₹${selected.total_cost.toFixed(2)}`, sub: `${selected.total_calls} calls made`, color: 'text-amber-600 dark:text-amber-400' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-850 rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{kpi.label}</p>
                    <p className={`text-lg font-extrabold ${kpi.color} mt-0.5`}>{kpi.value}</p>
                    <p className="text-[10px] text-gray-400">{kpi.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Status Breakdown */}
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-4">Contact Status Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: 'Completed', count: selected.completed_contacts, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Failed / No Answer', count: selected.failed_contacts, color: 'bg-red-400', textColor: 'text-red-500 dark:text-red-400' },
                  { label: 'Pending', count: selected.pending_contacts, color: 'bg-gray-300 dark:bg-gray-600', textColor: 'text-gray-500 dark:text-gray-400' },
                  { label: 'In Progress', count: selected.in_progress_contacts, color: 'bg-blue-400', textColor: 'text-blue-500 dark:text-blue-400' },
                ].map((item, i) => {
                  const pct = selected.total_contacts > 0 ? Math.round((item.count / selected.total_contacts) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{item.label}</span>
                        <span className={`font-extrabold ${item.textColor}`}>{item.count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: <Phone className="w-4 h-4" />, label: 'Calls Triggered', value: selected.total_calls, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                { icon: <Mic className="w-4 h-4" />, label: 'Recordings', value: selected.recordings_available, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/30' },
                { icon: <Award className="w-4 h-4" />, label: 'Answer Rate', value: `${selected.answer_rate}%`, color: selected.answer_rate >= 50 ? 'text-emerald-500' : 'text-amber-500', bg: selected.answer_rate >= 50 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30' },
              ].map((s, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <div className={`p-2 rounded-xl ${s.bg} ${s.color}`}>{s.icon}</div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{s.label}</p>
                    <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm text-gray-400 text-sm">
            Select a campaign to view analytics
          </div>
        )}
      </div>
    </div>
  )
}
