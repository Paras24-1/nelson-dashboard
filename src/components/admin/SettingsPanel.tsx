'use client'

import { useState, useEffect } from 'react'
import { X, Settings, Database, Cpu, User, Mail, Shield, Save, RefreshCw, Key, Bot } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useOrg } from '@/contexts/OrgContext'

interface SettingsData {
  whatsapp_token: string
  whatsapp_phone_id: string
  whatsapp_waba_id: string
  n8n_webhook_url: string
  n8n_reply_webhook_url: string
  google_sheet_id: string
  google_sheet_name: string
  google_sheets_api_key: string
  gemini_api_key: string
  ai_system_prompt: string
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { profile, org, user } = useOrg()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Developer protection states
  const [isEditable, setIsEditable] = useState(false)
  const [devPassword, setDevPassword] = useState('')
  const [showUnlockForm, setShowUnlockForm] = useState(false)

  const [formData, setFormData] = useState<SettingsData>({
    whatsapp_token: '',
    whatsapp_phone_id: '',
    whatsapp_waba_id: '',
    n8n_webhook_url: '',
    n8n_reply_webhook_url: '',
    google_sheet_id: '',
    google_sheet_name: 'LEADS',
    google_sheets_api_key: '',
    gemini_api_key: '',
    ai_system_prompt: ''
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/settings', {
          headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
        })
        if (res.ok) {
          const data = await res.json()
          setFormData({
            whatsapp_token: data.whatsapp_token || '',
            whatsapp_phone_id: data.whatsapp_phone_id || '',
            whatsapp_waba_id: data.whatsapp_waba_id || '',
            n8n_webhook_url: data.n8n_webhook_url || '',
            n8n_reply_webhook_url: data.n8n_reply_webhook_url || '',
            google_sheet_id: data.google_sheet_id || '',
            google_sheet_name: data.google_sheet_name || 'LEADS',
            google_sheets_api_key: data.google_sheets_api_key || '',
            gemini_api_key: data.gemini_api_key || '',
            ai_system_prompt: data.ai_system_prompt || ''
          })
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }

    if (isAdmin) {
      fetchSettings()
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to update settings')
      }

      setSuccess('Settings updated successfully!')
      setIsEditable(false) // Lock it back after saving
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const initials = (profile?.name || user?.email || 'U')
    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
            {org && <span className="text-xs text-gray-400 ml-1">— {org.name}</span>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl text-sm text-emerald-600 dark:text-emerald-400">
              {success}
            </div>
          )}

          {/* Section 1: Active Profile Context */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-850 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                  {profile?.name || 'User Profile'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 uppercase">
                  {profile?.role || 'user'}
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                {profile?.email || user?.email || 'N/A'}
              </p>
            </div>
          </div>

          {/* Section 2: Organization Settings (Admins/Owners only) */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          ) : !isAdmin ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-2.5">
              <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">Standard User Access</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  Only Administrators and Owners can view and configure organization Settings.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* WhatsApp Channel Setup */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-1.5">
                  <Key className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">WhatsApp Channel Setup</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">WhatsApp Phone Number ID</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={formData.whatsapp_phone_id}
                      onChange={e => setFormData({ ...formData, whatsapp_phone_id: e.target.value })}
                      placeholder="e.g. 1065987421356"
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">WhatsApp Business Account ID (WABA ID)</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={formData.whatsapp_waba_id}
                      onChange={e => setFormData({ ...formData, whatsapp_waba_id: e.target.value })}
                      placeholder="e.g. 1045987421356"
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Permanent Meta Access Token</label>
                    <input
                      type="password"
                      disabled={!isEditable}
                      value={formData.whatsapp_token}
                      onChange={e => setFormData({ ...formData, whatsapp_token: e.target.value })}
                      placeholder="EAAGy..."
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Google Sheet Sync */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-1.5">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Google Sheet Sync</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Google Sheet Spreadsheet ID</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={formData.google_sheet_id}
                      onChange={e => setFormData({ ...formData, google_sheet_id: e.target.value })}
                      placeholder="e.g. 1aBcDeFgHiJkLmNoP..."
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sheet Tab Name</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={formData.google_sheet_name}
                      onChange={e => setFormData({ ...formData, google_sheet_name: e.target.value })}
                      placeholder="e.g. LEADS"
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Google Sheets API Key</label>
                  <input
                    type="password"
                    disabled={!isEditable}
                    value={formData.google_sheets_api_key}
                    onChange={e => setFormData({ ...formData, google_sheets_api_key: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Automation (n8n) Integration */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-1.5">
                  <Cpu className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Automation (n8n) Integration</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">n8n Inbound Webhook URL</label>
                    <input
                      type="url"
                      disabled={!isEditable}
                      value={formData.n8n_webhook_url}
                      onChange={e => setFormData({ ...formData, n8n_webhook_url: e.target.value })}
                      placeholder="https://n8n.yourdomain.com/..."
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">n8n Reply Webhook URL</label>
                    <input
                      type="url"
                      disabled={!isEditable}
                      value={formData.n8n_reply_webhook_url}
                      onChange={e => setFormData({ ...formData, n8n_reply_webhook_url: e.target.value })}
                      placeholder="https://n8n.yourdomain.com/..."
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* AI Engine Credentials */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-1.5">
                  <Bot className="w-4 h-4 text-emerald-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">AI Engine Credentials & Behavior</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Gemini API Key</label>
                    <input
                      type="password"
                      value={formData.gemini_api_key}
                      onChange={e => setFormData({ ...formData, gemini_api_key: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Custom Chatbot Prompt (Optional)</label>
                    <textarea
                      disabled={!isEditable}
                      value={formData.ai_system_prompt}
                      onChange={e => setFormData({ ...formData, ai_system_prompt: e.target.value })}
                      placeholder="You are a WhatsApp AI consultant for iWebMagics..."
                      className="w-full px-3.5 py-2.5 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 h-[100px] resize-none disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end items-center pt-3 border-t border-gray-150 dark:border-gray-800 flex-wrap">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-gray-150 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Changes
                </button>

                {!isEditable && (
                  showUnlockForm ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="password"
                        placeholder="Developer Password"
                        value={devPassword}
                        onChange={e => setDevPassword(e.target.value)}
                        className="px-3 py-2 text-xs text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-36"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (devPassword === 'Paras@342') {
                            setIsEditable(true)
                            setShowUnlockForm(false)
                            setDevPassword('')
                            setError('')
                          } else {
                            setError('Incorrect developer password')
                          }
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
                      >
                        Unlock
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowUnlockForm(false); setDevPassword(''); setError(''); }}
                        className="px-3.5 py-2 bg-gray-150 dark:bg-gray-800 text-gray-750 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowUnlockForm(true)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Edit Developer Settings
                    </button>
                  )
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
