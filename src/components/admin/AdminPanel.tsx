'use client'

import { useState, useEffect } from 'react'
import { X, UserPlus, Trash2, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useOrg } from '@/contexts/OrgContext'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'employee' | 'owner'
  is_active: boolean
  created_at: string
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    email: '', name: '', password: '', role: 'employee' as 'admin' | 'employee'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { org } = useOrg()

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const fetchUsers = async () => {
    setLoading(true)
    const token = await getToken()
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (Array.isArray(data)) setUsers(data)
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

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
      setFormData({ email: '', name: '', password: '', role: 'employee' })
      setShowAddForm(false)
      fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Management</h2>
            {org && (
              <span className="text-xs text-gray-400 ml-1">— {org.name}</span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl text-sm text-emerald-600 dark:text-emerald-400">
              {success}
            </div>
          )}

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full mb-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-emerald-500 transition-colors flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-emerald-600"
            >
              <UserPlus className="w-5 h-5" />
              <span className="font-medium">Add New User</span>
            </button>
          )}

          {showAddForm && (
            <form onSubmit={handleAddUser} className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Create New User</h3>
              <input type="text" placeholder="Full Name" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
              <input type="email" placeholder="Email" value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
              <input type="password" placeholder="Password (min 6 characters)" value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required minLength={6} />
              <select value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'employee' })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">

                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                  Create User
                </button>
                <button type="button" onClick={() => { setShowAddForm(false); setFormData({ email: '', name: '', password: '', role: 'employee' }) }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {loading ? (
              <p className="text-center text-gray-500 py-8">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No users found</p>
            ) : (
              users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      user.role === 'owner' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                    }`}>
                      {user.role}
                    </span>
                    {user.role === 'employee' && (
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${user.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        title={user.is_active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${user.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    )}
                    {user.role !== 'owner' && (
                      <button onClick={() => handleDeleteUser(user.id)}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 transition-colors">
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
    </div>
  )
}