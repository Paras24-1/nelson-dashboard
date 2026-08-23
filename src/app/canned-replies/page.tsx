'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import CannedRepliesModal, { CannedReplyItem } from '@/components/chat/CannedRepliesModal'
import { Plus, Search, MessageSquare, Trash2, Edit3, Image as ImageIcon, MapPin, Type, FileText, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function CannedRepliesPage() {
  const [replies, setReplies] = useState<CannedReplyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CannedReplyItem | null>(null)

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  useEffect(() => {
    fetchCannedReplies()
  }, [])

  const fetchCannedReplies = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/canned-replies', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setReplies(data)
      }
    } catch (err) {
      console.error('Fetch canned replies error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveReply = async (item: CannedReplyItem) => {
    const method = item.id ? 'PUT' : 'POST'
    const token = await getToken()
    const res = await fetch('/api/canned-replies', {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(item)
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to save canned reply')
    }

    await fetchCannedReplies()
  }

  const handleDeleteReply = async (id: string) => {
    if (!confirm('Are you sure you want to delete this canned reply?')) return

    try {
      const token = await getToken()
      const res = await fetch(`/api/canned-replies?id=${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to delete')
      setReplies((prev) => prev.filter((r) => r.id !== id))
    } catch (err: any) {
      alert(`Delete error: ${err.message || String(err)}`)
    }
  }

  const filteredReplies = replies.filter(
    (r) =>
      r.shortcut.toLowerCase().includes(search.toLowerCase()) ||
      (r.title && r.title.toLowerCase().includes(search.toLowerCase())) ||
      (r.content && r.content.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="px-8 py-5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Sidebar />
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Canned Replies & Shortcuts</h1>
            <p className="text-xs text-slate-400">Manage quick `/` shortcuts for your team to send instant replies to leads</p>
          </div>
        </div>

          <button
            onClick={() => {
              setEditingItem(null)
              setIsModalOpen(true)
            }}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Canned Reply</span>
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {/* Search Bar */}
          <div className="max-w-md relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by shortcut name or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Grid of Canned Replies */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-sm">Loading canned replies...</span>
            </div>
          ) : filteredReplies.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 p-8 space-y-3">
              <Sparkles className="w-8 h-8 text-blue-400 mx-auto" />
              <h3 className="text-base font-bold text-white">No Canned Replies Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Create your first quick reply (e.g. <span className="font-mono text-emerald-400">/charbi_ki_ganth</span> or <span className="font-mono text-emerald-400">/gall_stone</span>) to speed up responses in chat!
              </p>
              <button
                onClick={() => {
                  setEditingItem(null)
                  setIsModalOpen(true)
                }}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-all"
              >
                Create Shortcut Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredReplies.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-lg"
                >
                  <div className="space-y-3">
                    {/* Top Row: Shortcut Badge & Type */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          /{item.shortcut}
                        </span>
                        <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {item.type}
                      </span>
                    </div>

                    {/* Media Thumbnail if any */}
                    {item.media_url && (
                      <div className="rounded-xl overflow-hidden border border-slate-800 max-h-36 bg-black/40">
                        {item.type === 'image' ? (
                          <img src={item.media_url} alt={item.shortcut} className="w-full h-32 object-cover" />
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-400">
                            [{item.type.toUpperCase()}: {item.filename || 'File Attachment'}]
                          </div>
                        )}
                      </div>
                    )}

                    {/* Location Preview if any */}
                    {item.type === 'location' && item.location_data && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{item.location_data.name || 'Location'}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{item.location_data.address}</p>
                      </div>
                    )}

                    {/* Content Text */}
                    {item.content && (
                      <p className="text-xs text-slate-300 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                        {item.content}
                      </p>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between mt-4">
                    <span className="text-[11px] text-slate-500">
                      Type <span className="font-mono text-slate-300">/{item.shortcut}</span> in chat
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingItem(item)
                          setIsModalOpen(true)
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                        title="Edit Canned Reply"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => item.id && handleDeleteReply(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Delete Canned Reply"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      {/* Canned Replies Modal */}
      <CannedRepliesModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingItem(null)
        }}
        onSave={handleSaveReply}
        initialData={editingItem}
      />
    </div>
  )
}
