'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/contexts/OrgContext'
import Sidebar from '@/components/Sidebar'
import { 
  Globe, Search, Sliders, Play, Trash2, CheckCircle2, 
  XCircle, Loader2, ArrowRight, Download, Upload, 
  MapPin, Phone, Star, Award, Check
} from 'lucide-react'

interface ScrapingJob {
  id: string
  query: string
  max_results: number
  status: 'pending' | 'scraping' | 'completed' | 'failed'
  scraped_count: number
  error_message: string | null
  created_at: string
}

interface ScrapedLead {
  id: string
  name: string
  address: string
  phone: string
  website: string
  rating: string
  reviews_count: string
  category: string
  google_maps_url: string
  imported: boolean
}

export const dynamic = 'force-dynamic'

export default function ScraperPage() {
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

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 min-h-screen p-6 md:p-8 ml-64 transition-all overflow-x-hidden text-gray-900 dark:text-gray-100">
        <ScraperContent />
      </main>
    </div>
  )
}

function ScraperContent() {
  const [jobs, setJobs] = useState<ScrapingJob[]>([])
  const [selectedJob, setSelectedJob] = useState<ScrapingJob | null>(null)
  const [leads, setLeads] = useState<ScrapedLead[]>([])
  const [leadsSearch, setLeadsSearch] = useState('')
  
  // Form input states
  const [query, setQuery] = useState('')
  const [maxResults, setMaxResults] = useState(50)
  
  // Loading & Action states
  const [jobsLoading, setJobsLoading] = useState(true)
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [importingMap, setImportingMap] = useState<Record<string, boolean>>({})

  // Fetch all jobs
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/scraper/jobs')
      if (res.ok) {
        const data = await res.json()
        setJobs(data)
        
        // If there was a selected job, keep it updated with new stats
        if (selectedJob) {
          const updated = data.find((j: ScrapingJob) => j.id === selectedJob.id)
          if (updated) setSelectedJob(updated)
        }
      }
    } catch (err) {
      console.error('Failed to load jobs list:', err)
    } finally {
      setJobsLoading(false)
    }
  }, [selectedJob])

  // Poll active jobs if any is running
  useEffect(() => {
    fetchJobs()
    const activeInterval = setInterval(() => {
      const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'scraping')
      if (hasActive) {
        fetchJobs()
      }
    }, 4000)

    return () => clearInterval(activeInterval)
  }, [jobs.length, fetchJobs])

  // Fetch leads when selected job changes
  useEffect(() => {
    if (!selectedJob) {
      setLeads([])
      return
    }

    const fetchLeads = async () => {
      setLeadsLoading(true)
      try {
        const res = await fetch(`/api/scraper/leads?job_id=${selectedJob.id}`)
        if (res.ok) {
          const data = await res.json()
          setLeads(data)
        }
      } catch (err) {
        console.error('Failed to load scraped leads:', err)
      } finally {
        setLeadsLoading(false)
      }
    }

    fetchLeads()
  }, [selectedJob?.id, selectedJob?.status])

  // Launch a new job
  const handleLaunchJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    
    setSubmitting(true)
    try {
      const res = await fetch('/api/scraper/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), max_results: maxResults })
      })

      if (res.ok) {
        const newJob = await res.json()
        setJobs(prev => [newJob, ...prev])
        setSelectedJob(newJob)
        setQuery('')
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to trigger scraper')
      }
    } catch (err) {
      console.error(err)
      alert('Network error launching scraper')
    } finally {
      setSubmitting(false)
    }
  }

  // Import a lead to CRM
  const handleImportLead = async (leadId: string) => {
    setImportingMap(prev => ({ ...prev, [leadId]: true }))
    try {
      const res = await fetch('/api/scraper/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId })
      })

      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, imported: true } : l))
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to import lead')
      }
    } catch (err) {
      console.error(err)
      alert('Error importing lead')
    } finally {
      setImportingMap(prev => ({ ...prev, [leadId]: false }))
    }
  }

  // Bulk Import Leads to CRM
  const handleBulkImport = async () => {
    const unimported = leads.filter(l => !l.imported)
    if (unimported.length === 0) return
    
    if (!confirm(`Are you sure you want to import ${unimported.length} leads to your CRM?`)) return

    for (const lead of unimported) {
      setImportingMap(prev => ({ ...prev, [lead.id]: true }))
      try {
        await fetch('/api/scraper/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: lead.id })
        })
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, imported: true } : l))
      } catch (err) {
        console.error('Failed to import bulk item:', lead.name, err)
      } finally {
        setImportingMap(prev => ({ ...prev, [lead.id]: false }))
      }
    }
  }

  // Download Job Leads as CSV
  const handleDownloadCSV = () => {
    if (leads.length === 0 || !selectedJob) return
    
    const headersList = ["Business Name", "Phone", "Website", "Category", "Rating", "Reviews", "Address", "Maps URL"]
    const rows = leads.map(l => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${l.phone || ''}"`,
      `"${l.website || ''}"`,
      `"${(l.category || '').replace(/"/g, '""')}"`,
      `"${l.rating || ''}"`,
      `"${l.reviews_count || ''}"`,
      `"${(l.address || '').replace(/"/g, '""')}"`,
      `"${l.google_maps_url || ''}"`
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headersList.join(","), ...rows.map(r => r.join(","))].join("\n")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    const cleanQueryName = selectedJob.query.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    link.setAttribute("download", `google_maps_leads_${cleanQueryName}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtered leads view calculations
  const filteredLeads = leads.filter(l => {
    const searchLower = leadsSearch.toLowerCase()
    return (
      (l.name || '').toLowerCase().includes(searchLower) ||
      (l.phone || '').toLowerCase().includes(searchLower) ||
      (l.category || '').toLowerCase().includes(searchLower) ||
      (l.address || '').toLowerCase().includes(searchLower)
    )
  })

  // Check if current active job is running
  const runningJob = jobs.find(j => j.status === 'pending' || j.status === 'scraping')

  return (
    <div className="space-y-8">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Globe className="w-7 h-7 text-emerald-500 animate-spin-slow" />
            Google Maps Leads Scraper
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Target local listings in the cloud via Railway and inject them directly into your CRM.
          </p>
        </div>
      </div>

      {/* Grid: Config Form & Job History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Scraper Trigger Config */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="mb-6 flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Sliders className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Leads Configurator</h3>
            </div>

            <form onSubmit={handleLaunchJob} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Search Query</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    disabled={!!runningJob}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Dentists in Mumbai..."
                    className="w-full pl-10 pr-4 py-3 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-150 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  <span>Max Results</span>
                  <span className="text-emerald-500 font-extrabold">{maxResults} business profiles</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  disabled={!!runningJob}
                  value={maxResults}
                  onChange={e => setMaxResults(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer disabled:opacity-50"
                />
              </div>

              {runningJob ? (
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-150 dark:border-emerald-900/40 text-xs">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold mb-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scraping in progress...
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-relaxed">
                    Railway is executing headless chromium automation for: <strong>"{runningJob.query}"</strong>. 
                  </p>
                  <div className="mt-3 flex items-center justify-between font-extrabold text-[10px] text-gray-400 uppercase">
                    <span>Scraped Count</span>
                    <span className="text-emerald-500 text-xs">{runningJob.scraped_count} / {runningJob.max_results}</span>
                  </div>
                  <div className="w-full bg-gray-150 dark:bg-gray-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div 
                      style={{ width: `${(runningJob.scraped_count / runningJob.max_results) * 100}%` }}
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform fill-current" />
                      Launch Cloud Scraper
                    </>
                  )}
                </button>
              )}
            </form>
          </div>

          <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-4 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <span>Powered by Railway Cloud</span>
            <span>v1.0.0</span>
          </div>
        </div>

        {/* Scraping Runs List */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Scraping Runs History</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Select any scraping request to view and inspect its extracted contacts</p>
            </div>

            {jobsLoading ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                Loading runs list...
              </div>
            ) : jobs.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">
                No scraping jobs launched yet. Add a query to start.
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {jobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id
                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected 
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 dark:border-emerald-800' 
                          : 'bg-gray-50 dark:bg-gray-950 border-gray-150 dark:border-gray-850 hover:bg-gray-100/50 dark:hover:bg-gray-900/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          "{job.query}"
                        </p>
                        <p className="text-[10px] text-gray-400 block mt-1">
                          Created: {new Date(job.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-black text-gray-950 dark:text-white">{job.scraped_count} leads</span>
                          <span className="text-[9px] text-gray-400 block font-bold uppercase mt-0.5">Target: {job.max_results}</span>
                        </div>

                        {job.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {job.status === 'failed' && <XCircle className="w-4 h-4 text-rose-500" />}
                        {(job.status === 'scraping' || job.status === 'pending') && <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Scraped Leads Table results */}
      {selectedJob && (
        <div className="bg-white dark:bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-800/80 p-6 shadow-sm">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-100 dark:border-gray-850 pb-5">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Scraped Leads List — "{selectedJob.query}"
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Verify, search, export, or push leads into your pipeline
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDownloadCSV}
                disabled={leads.length === 0}
                className="px-3.5 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>

              <button
                onClick={handleBulkImport}
                disabled={leads.filter(l => !l.imported).length === 0}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Import Unimported ({leads.filter(l => !l.imported).length})
              </button>
            </div>
          </div>

          {/* Search Table */}
          {leads.length > 0 && (
            <div className="relative mb-4 max-w-sm">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search scraped name, category, or phone..."
                value={leadsSearch}
                onChange={e => setLeadsSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-150 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* Table Container */}
          {leadsLoading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
              Loading scraped lead profiles...
            </div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center text-xs text-gray-400">
              {selectedJob.status === 'scraping' || selectedJob.status === 'pending' 
                ? 'Job is running. Leads will populate automatically in real-time.' 
                : 'No leads returned for this scraping job.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-150 dark:border-gray-850">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-150 dark:border-gray-850 bg-gray-50 dark:bg-gray-950">
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Business Name</th>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Phone</th>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Category</th>
                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Rating</th>
                    <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Address</th>
                    <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-semibold text-gray-900 dark:text-white max-w-[200px] truncate">
                        {lead.google_maps_url ? (
                          <a 
                            href={lead.google_maps_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-emerald-500 transition-colors flex items-center gap-1.5"
                          >
                            {lead.name}
                            <Globe className="w-3 h-3 text-gray-400" />
                          </a>
                        ) : (
                          lead.name
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-gray-600 dark:text-gray-300">
                        {lead.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            {lead.phone}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                          {lead.category || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-center font-bold">
                        {lead.rating ? (
                          <span className="inline-flex items-center gap-1 text-amber-500">
                            <Star className="w-3 h-3 fill-current" />
                            {lead.rating}
                            <span className="text-[10px] text-gray-400 font-medium">({lead.reviews_count || 0})</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={lead.address}>
                        {lead.address || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {lead.imported ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            <Check className="w-3.5 h-3.5" />
                            Imported
                          </span>
                        ) : (
                          <button
                            onClick={() => handleImportLead(lead.id)}
                            disabled={importingMap[lead.id]}
                            className="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-gray-600 dark:text-gray-400 hover:text-emerald-500 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 mx-auto disabled:opacity-50"
                          >
                            {importingMap[lead.id] ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Upload className="w-3 h-3" />
                                Add CRM
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
        </div>
      )}

    </div>
  )
}
