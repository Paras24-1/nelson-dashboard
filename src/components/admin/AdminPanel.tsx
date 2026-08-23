'use client'

import { useState, useEffect } from 'react'
import { X, UserPlus, Trash2, Shield, Phone, Mail, Check, Edit2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useOrg } from '@/contexts/OrgContext'

import { createPortal } from 'react-dom'

interface User {
  id: string
  email: string
  name: string
  phone_number?: string
  role: 'admin' | 'employee' | 'owner'
  is_active: boolean
  created_at: string
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editPhone, setEditPhone] = useState('')
  const [editingSaving, setEditingSaving] = useState(false)

  const [formData, setFormData] = useState({
    email: '', 
    name: '', 
    phone_number: '',
    password: '', 
    role: 'employee' as 'admin' | 'employee'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { org } = useOrg()

  useEffect(() => {
    setMounted(true)
    fetchUsers()
  }, [])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (Array.isArray(data)) setUsers(data)
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const token = await getToken()
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess('User created successfully!')
      setFormData({ email: '', name: '', phone_number: '', password: '', role: 'employee' })
      setShowAddForm(false)
      fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    }
  }

  const handleSavePhone = async (userId: string) => {
    setEditingSaving(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, phone_number: editPhone })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEditingUserId(null)
      fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to update phone number')
    } finally {
      setEditingSaving(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    try {
      const token = await getToken()
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    }
  }

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const token = await getToken()
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, is_active: !currentStatus })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Team Management</h2>
            {org && (
              <span className="text-xs text-slate-400 ml-1">— {org.name}</span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400">
              {success}
            </div>
          )}

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/50 hover:bg-slate-950 rounded-2xl transition-all flex items-center justify-center gap-2 text-slate-400 hover:text-emerald-400 group text-xs font-bold"
            >
              <UserPlus className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Add New Team Member</span>
            </button>
          )}

          {showAddForm && (
            <form onSubmit={handleAddUser} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Create New Team Member</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Phone Number (e.g. +91 9876543210)"
                  value={formData.phone_number}
                  onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <input
                  type="password"
                  placeholder="Password (min 6 chars)"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'employee' })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setFormData({ email: '', name: '', phone_number: '', password: '', role: 'employee' }) }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-slate-500 py-8 text-xs">No team members found</p>
            ) : (
              users.map(user => (
                <div key={user.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 font-black text-xs shrink-0 shadow-inner">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-white truncate">{user.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          user.role === 'owner' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          user.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {user.email}
                        </span>

                        {editingUserId === user.id ? (
                          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <input
                              type="text"
                              value={editPhone}
                              onChange={e => setEditPhone(e.target.value)}
                              placeholder="+91 9876543210"
                              className="bg-transparent text-[11px] font-mono text-white focus:outline-none w-32"
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePhone(user.id)}
                              disabled={editingSaving}
                              className="p-1 text-emerald-400 hover:text-white"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="p-1 text-slate-500 hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 group/phone cursor-pointer hover:text-emerald-400" onClick={() => { setEditingUserId(user.id); setEditPhone(user.phone_number || ''); }}>
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <span className="font-mono">{user.phone_number || 'Add Phone'}</span>
                            <Edit2 className="w-2.5 h-2.5 text-slate-600 opacity-0 group-hover/phone:opacity-100 transition-opacity" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {user.role === 'employee' && (
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${user.is_active ? 'bg-emerald-500' : 'bg-slate-800'}`}
                        title={user.is_active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${user.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    )}
                    {user.role !== 'owner' && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  )
}