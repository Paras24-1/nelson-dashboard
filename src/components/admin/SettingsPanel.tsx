'use client'

import { useState, useEffect } from 'react'
import { X, Settings, Database, Cpu, User, Mail, Shield, Save, RefreshCw, Key, Bot } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useOrg } from '@/contexts/OrgContext'

interface SettingsData {
  whatsapp_token: string
  whatsapp_phone_id: string
  whatsapp_waba_id: string
  n8n_inbound_webhook_url: string
  n8n_webhook_url: string
  n8n_reply_webhook_url: string
  google_sheet_id: string
  google_sheet_name: string
  google_sheets_api_key: string
  gemini_api_key: string
  ai_system_prompt: string
  ai_knowledge_base_sheet_id: string
  ai_knowledge_base_range: string
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
    n8n_inbound_webhook_url: '',
    n8n_webhook_url: '',
    n8n_reply_webhook_url: '',
    google_sheet_id: '',
    google_sheet_name: 'LEADS',
    google_sheets_api_key: '',
    gemini_api_key: '',
    ai_system_prompt: '',
    ai_knowledge_base_sheet_id: '',
    ai_knowledge_base_range: 'Sheet1!A:Z'
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
            n8n_inbound_webhook_url: data.n8n_inbound_webhook_url || '',
            n8n_webhook_url: data.n8n_webhook_url || '',
            n8n_reply_webhook_url: data.n8n_reply_webhook_url || '',
            google_sheet_id: data.google_sheet_id || '',
            google_sheet_name: data.google_sheet_name || 'LEADS',
            google_sheets_api_key: data.google_sheets_api_key || '',
            gemini_api_key: data.gemini_api_key || '',
            ai_system_prompt: data.ai_system_prompt || '',
            ai_knowledge_base_sheet_id: data.ai_knowledge_base_sheet_id || '',
            ai_knowledge_base_range: data.ai_knowledge_base_range || 'Sheet1!A:Z'
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
      setIsEditable(false)
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Organization Settings</h2>
            {org && <span className="text-xs text-slate-400 ml-1">— {org.name}</span>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

          {/* Section 1: Active Profile Context */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 font-black text-base shadow-inner">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate">
                  {profile?.name || 'User Profile'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                  {profile?.role || 'user'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
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
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5">
              <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400">Standard User Access</p>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Only Administrators and Owners can view and configure organization Settings.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* WhatsApp Channel Setup */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">WhatsApp API Credentials</h4>
                  </div>
                  {!isEditable && (
                    <button
                      type="button"
                      onClick={() => setIsEditable(true)}
                      className="text-[11px] font-bold text-emerald-400 hover:underline"
                    >
                      Edit Fields
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">WhatsApp Phone Number ID</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={formData.whatsapp_phone_id}
                      onChange={e => setFormData({ ...formData, whatsapp_phone_id: e.target.value })}
                      placeholder="e.g. 1065987421356"
                      className="w-full px-3.5 py-2.5 text-xs text-white bg-slate-950 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">WABA ID</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={formData.whatsapp_waba_id}
                      onChange={e => setFormData({ ...formData, whatsapp_waba_id: e.target.value })}
                      placeholder="e.g. 1045987421356"
                      className="w-full px-3.5 py-2.5 text-xs text-white bg-slate-950 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Permanent Meta Access Token</label>
                    <input
                      type="password"
                      disabled={!isEditable}
                      value={formData.whatsapp_token}
                      onChange={e => setFormData({ ...formData, whatsapp_token: e.target.value })}
                      placeholder="EAAGy..."
                      className="w-full px-3.5 py-2.5 text-xs text-white bg-slate-950 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Google Sheet Sync */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Google Sheet Sync</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Google Sheet Spreadsheet ID</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={formData.google_sheet_id}
                      onChange={e => setFormData({ ...formData, google_sheet_id: e.target.value })}
                      placeholder="e.g. 1aBcDeFgHiJkLmNoP..."
                      className="w-full px-3.5 py-2.5 text-xs text-white bg-slate-950 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Sheet Tab Name</label>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={formData.google_sheet_name}
                      onChange={e => setFormData({ ...formData, google_sheet_name: e.target.value })}
                      placeholder="LEADS"
                      className="w-full px-3.5 py-2.5 text-xs text-white bg-slate-950 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Automation / n8n Webhooks */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Automation (n8n) Integration</h4>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">n8n Inbound Webhook URL</label>
                    <input
                      type="url"
                      disabled={!isEditable}
                      value={formData.n8n_inbound_webhook_url}
                      onChange={e => setFormData({ ...formData, n8n_inbound_webhook_url: e.target.value })}
                      placeholder="https://n8n.yourdomain.com/webhook/inbound"
                      className="w-full px-3.5 py-2.5 text-xs text-white bg-slate-950 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
                {isEditable && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Save Settings</span>
                  </button>
                )}
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  )
}
