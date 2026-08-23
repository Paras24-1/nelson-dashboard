'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import { 
  Brain, Cpu, Database, RefreshCw, Save, Sparkles, Check, AlertCircle, 
  ExternalLink, FileSpreadsheet, Key, Send, Bot, User, Loader2, Code2, Layers, Table
} from 'lucide-react'

export default function BotBrainPage() {
  const [engineMode, setEngineMode] = useState<'native' | 'hybrid_n8n'>('native')
  const [aiProvider, setAiProvider] = useState('gemini')
  const [aiModelName, setAiModelName] = useState('gemini-1.5-flash')
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful and polite WhatsApp AI sales consultant for Kataria Herbal Remedies.\n\nUse the Knowledge Base price list below to answer user queries accurately. Keep answers concise.'
  )
  const [googleSheetId, setGoogleSheetId] = useState('')
  const [googleSheetName, setGoogleSheetName] = useState('Sheet1')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('')
  
  const [cachedKb, setCachedKb] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // AI Sandbox Chat Testing State
  const [sandboxInput, setSandboxInput] = useState('')
  const [sandboxMessages, setSandboxMessages] = useState<Array<{ role: 'user' | 'bot'; text: string }>>([
    { role: 'bot', text: 'Hello! I am your Bot Brain AI assistant. How can I help you today?' }
  ])
  const [testingAi, setTestingAi] = useState(false)

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/bot-brain', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setEngineMode(data.engine_mode || 'native')
        setAiProvider(data.ai_provider || 'gemini')
        setAiModelName(data.ai_model_name || 'gemini-1.5-flash')
        if (data.system_prompt) setSystemPrompt(data.system_prompt)
        setGoogleSheetId(data.google_sheet_id || '')
        setGoogleSheetName(data.google_sheet_name || 'Sheet1')
        setGeminiApiKey(data.gemini_api_key || '')
        setOpenaiApiKey(data.openai_api_key || '')
        setN8nWebhookUrl(data.n8n_inbound_webhook_url || '')
        if (data.cached_kb) setCachedKb(data.cached_kb)
      }
    } catch (err) {
      console.error('Fetch bot brain error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncSheet = async () => {
    if (!googleSheetId) {
      alert('Please enter a Google Sheet ID or URL first')
      return
    }
    setSyncing(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/bot-brain', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'sync_sheet',
          sheet_id: googleSheetId,
          sheet_name: googleSheetName
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to sync sheet')

      setCachedKb(data.cached_kb)
      alert(`Knowledge Base Synced Successfully! Loaded ${data.cached_kb.totalRows} items.`)
    } catch (err: any) {
      console.error('Sync error:', err)
      alert(`Google Sheet Sync Error: ${err.message || String(err)}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/bot-brain', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          engine_mode: engineMode,
          ai_provider: aiProvider,
          ai_model_name: aiModelName,
          system_prompt: systemPrompt,
          google_sheet_id: googleSheetId,
          google_sheet_name: googleSheetName,
          gemini_api_key: geminiApiKey,
          openai_api_key: openaiApiKey,
          n8n_inbound_webhook_url: n8nWebhookUrl,
          cached_kb: cachedKb
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save settings')
      }

      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 3000)
    } catch (err: any) {
      console.error('Save error:', err)
      alert(`Failed to save Bot Brain settings: ${err.message || String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  // Sandbox Test AI Response
  const handleTestSandboxSend = () => {
    if (!sandboxInput.trim()) return
    const userMsg = sandboxInput.trim()
    setSandboxInput('')

    setSandboxMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setTestingAi(true)

    setTimeout(() => {
      // Simulate AI response using cached KB and System Prompt
      let replyText = `I have received your query: "${userMsg}". `
      if (cachedKb?.json && cachedKb.json.length > 0) {
        const matchedItem = cachedKb.json.find((item: any) => 
          Object.values(item).some((val: any) => String(val).toLowerCase().includes(userMsg.toLowerCase()))
        )
        if (matchedItem) {
          replyText = `Based on your Knowledge Base: ${Object.entries(matchedItem).map(([k, v]) => `${k}: ${v}`).join(', ')}`
        } else {
          replyText = `Thank you for contacting Kataria Herbal Remedies! Our price list includes items like ${cachedKb.json.slice(0, 2).map((i: any) => Object.values(i)[0] || 'item').join(', ')}. How can I assist you further?`
        }
      } else {
        replyText += `(Bot Brain prompt is configured for ${engineMode === 'native' ? 'Native Dashboard AI' : 'Hybrid n8n'}).`
      }

      setSandboxMessages(prev => [...prev, { role: 'bot', text: replyText }])
      setTestingAi(false)
    }, 600)
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <header className="px-8 py-5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Sidebar />
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Bot Brain & Knowledge Control Hub</h1>
            <p className="text-xs text-slate-400">Configure AI System Prompt, 2-Way Google Sheets Knowledge Base, and Engine Modes</p>
          </div>
        </div>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'Settings Saved!' : 'Save Bot Brain'}</span>
          </button>
        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <span className="text-sm">Loading Bot Brain configurations...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left & Middle Column: Controls & KB Settings */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. AI Execution Engine Mode */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                    <Cpu className="w-5 h-5 text-purple-400" />
                    <h2 className="text-base font-bold text-white">1. Select AI Execution Engine</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Native Mode */}
                    <button
                      type="button"
                      onClick={() => setEngineMode('native')}
                      className={`p-4 rounded-xl border text-left transition-all relative ${
                        engineMode === 'native'
                          ? 'bg-purple-500/10 border-purple-500 text-white shadow-md shadow-purple-500/10'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-white">Native Dashboard AI</span>
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          SIMPLE (NO N8N)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Dashboard handles Meta webhooks, queries Google Sheets KB, and generates AI replies directly via Gemini / OpenAI. Zero n8n required.
                      </p>
                    </button>

                    {/* Hybrid n8n Mode */}
                    <button
                      type="button"
                      onClick={() => setEngineMode('hybrid_n8n')}
                      className={`p-4 rounded-xl border text-left transition-all relative ${
                        engineMode === 'hybrid_n8n'
                          ? 'bg-blue-500/10 border-blue-500 text-white shadow-md shadow-blue-500/10'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-white">Hybrid n8n Workflow</span>
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          ADVANCED (N8N)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Dashboard logs message, packages Bot Brain context + Knowledge Base into an enriched JSON payload, and posts to n8n for complex workflows.
                      </p>
                    </button>
                  </div>

                  {/* n8n Webhook URL input if hybrid */}
                  {engineMode === 'hybrid_n8n' && (
                    <div className="space-y-1.5 pt-2 animate-in fade-in">
                      <label className="text-xs font-semibold text-slate-300">n8n Inbound Webhook URL:</label>
                      <input
                        type="url"
                        placeholder="https://your-n8n.app/webhook/whatsapp-agent"
                        value={n8nWebhookUrl}
                        onChange={(e) => setN8nWebhookUrl(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Organization Gemini & AI API Keys */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Key className="w-5 h-5 text-amber-400" />
                      <div>
                        <h2 className="text-base font-bold text-white">2. Organization Gemini API Key</h2>
                        <p className="text-xs text-slate-400">
                          {engineMode === 'native' 
                            ? 'Used directly by Native Dashboard AI for generating customer replies.'
                            : 'Sent inside the Enriched Webhook payload to n8n for execution.'
                          }
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase font-mono">
                      {engineMode === 'native' ? 'Active in Native AI' : 'Forwarded to n8n'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>Gemini API Key:</span>
                        <a 
                          href="https://aistudio.google.com/app/apikey" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <span>Get Free Key</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </label>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-semibold text-slate-300">OpenAI API Key (Optional Fallback):</label>
                      <input
                        type="password"
                        placeholder="sk-proj-..."
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. System Prompt & Model Config */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      <h2 className="text-base font-bold text-white">3. AI System Prompt & Intelligence</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={aiModelName}
                        onChange={(e) => setAiModelName(e.target.value)}
                        className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-emerald-400 font-semibold focus:outline-none"
                      >
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                        <option value="gpt-4o-mini">OpenAI GPT-4o-mini</option>
                      </select>
                    </div>
                  </div>

                  {/* Variable insertion buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-bold uppercase">Insert Variables:</span>
                    {['{{lead_name}}', '{{phone_number}}', '{{knowledge_base}}', '{{stage}}'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSystemPrompt((prev) => prev + ` ${tag}`)}
                        className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-mono text-emerald-400 transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={6}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter the AI agent system prompt instructions..."
                    className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
                  />
                </div>

                {/* 4. Live 2-Way Google Sheet Knowledge Base */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                      <div>
                        <h2 className="text-base font-bold text-white">4. Live Google Sheets Knowledge Base</h2>
                        <p className="text-xs text-slate-400">Live sync price lists, FAQs, and products into the AI Bot Brain</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSyncSheet}
                      disabled={syncing}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-purple-500/20"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      <span>{syncing ? 'Syncing...' : 'Sync Sheet Now'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8 space-y-1">
                      <label className="text-xs font-semibold text-slate-300">Google Sheet ID or Public Share Link:</label>
                      <input
                        type="text"
                        placeholder="e.g. 1yrRpQZDvu0vZQBp75v29Re10djci8WJUuIcCSOnAcpo"
                        value={googleSheetId}
                        onChange={(e) => setGoogleSheetId(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-xs font-semibold text-slate-300">Tab Name:</label>
                      <input
                        type="text"
                        placeholder="Sheet1"
                        value={googleSheetName}
                        onChange={(e) => setGoogleSheetName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Synced Knowledge Base Table Preview */}
                  {cachedKb ? (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <Table className="w-3.5 h-3.5" />
                          <span>Synced Knowledge Table ({cachedKb.totalRows || 0} items)</span>
                        </span>
                        <span className="text-[10px] text-slate-500">Synced at: {new Date(cachedKb.lastSyncedAt).toLocaleTimeString()}</span>
                      </div>

                      <div className="bg-slate-950 rounded-xl border border-slate-800 max-h-48 overflow-auto p-3">
                        <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {cachedKb.markdown}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                      No Knowledge Base synced yet. Paste your Google Sheet ID and click "Sync Sheet Now".
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: AI Sandbox Interactive Tester */}
              <div className="lg:col-span-5 flex flex-col h-[750px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                
                {/* Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="font-bold text-xs text-white uppercase tracking-wider">Bot Brain Sandbox Tester</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    REALTIME PREVIEW
                  </span>
                </div>

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]">
                  {sandboxMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-[#005c4b] text-white rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {testingAi && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 text-slate-400 p-3 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>Bot Brain is generating response...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Test your Bot Brain with a query (e.g. RO Filter rate?)..."
                    value={sandboxInput}
                    onChange={(e) => setSandboxInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTestSandboxSend()}
                    className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleTestSandboxSend}
                    className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all shadow-md"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>
    </div>
  )
}
