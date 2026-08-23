'use client'

import { useState, useMemo } from 'react'
import { X, FileText, Plus, Trash2, Send, Sparkles, Loader2, Info, Eye, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface CreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (templateName: string) => void
}

export default function CreateTemplateModal({ isOpen, onClose, onSuccess }: CreateTemplateModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING')
  const [language, setLanguage] = useState('en_US')
  const [headerFormat, setHeaderFormat] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('NONE')
  const [headerText, setHeaderText] = useState('')
  const [bodyText, setBodyText] = useState('Hello {{1}}, welcome to {{2}}! We are offering an exclusive discount today.')
  const [footerText, setFooterText] = useState('Reply STOP to unsubscribe')
  const [buttons, setButtons] = useState<Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone_number?: string }>>([
    { type: 'QUICK_REPLY', text: 'Claim Discount' }
  ])

  // Sample variable values mapping for {{1}}, {{2}}, etc.
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({
    '1': 'Kartik',
    '2': 'Kataria Herbal'
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detect {{1}}, {{2}}, {{3}} variables in body text
  const detectedVars = useMemo(() => {
    const matches = bodyText.match(/{{([0-9]+)}}/g) || []
    const unique = Array.from(new Set(matches.map(m => m.replace(/[{}]/g, ''))))
    return unique.sort((a, b) => parseInt(a) - parseInt(b))
  }, [bodyText])

  // Substitute sample values into preview body
  const previewBody = useMemo(() => {
    let result = bodyText || ''
    detectedVars.forEach(num => {
      const sample = sampleValues[num] || `{{${num}}}`
      result = result.replace(new RegExp(`{{${num}}}`, 'g'), sample)
    })
    return result
  }, [bodyText, detectedVars, sampleValues])

  if (!isOpen) return null

  const handleAddVariableTag = () => {
    const nextNum = (detectedVars.length + 1).toString()
    setBodyText(prev => prev + ` {{${nextNum}}}`)
    setSampleValues(prev => ({ ...prev, [nextNum]: `Sample_${nextNum}` }))
  }

  const handleAddButton = () => {
    if (buttons.length >= 3) {
      alert('Meta allows up to 3 buttons per template')
      return
    }
    setButtons(prev => [...prev, { type: 'QUICK_REPLY', text: 'Quick Action' }])
  }

  const handleRemoveButton = (idx: number) => {
    setButtons(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmitToMeta = async () => {
    setError(null)
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!cleanName) {
      setError('Please enter a valid template name (letters, numbers, underscores)')
      return
    }
    if (!bodyText.trim()) {
      setError('Please enter the main template body text')
      return
    }

    // Build sample values array for Meta API
    const sampleArray = detectedVars.map(num => sampleValues[num] || `Sample_${num}`)

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: cleanName,
          category,
          language,
          header_format: headerFormat,
          header_text: headerText,
          body_text: bodyText,
          body_examples: sampleArray,
          footer_text: footerText,
          buttons
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Meta rejected template creation')

      alert(`Template "${cleanName}" submitted to Meta! Status: ${data.status || 'PENDING'}`)
      onSuccess(cleanName)
      onClose()
    } catch (err: any) {
      console.error('Submit template error:', err)
      setError(err.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[88vh] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create & Submit Meta Template</h2>
              <p className="text-xs text-slate-400">Design WhatsApp templates and submit directly to Meta for approval</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-xs text-red-400 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body + Live WhatsApp Card Preview */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Side: Form Controls */}
          <div className="lg:col-span-7 overflow-y-auto p-6 space-y-5 border-r border-slate-800">
            
            {/* 1. Name, Category & Language */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-white uppercase tracking-wider">1. Basic Details</label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">Template Name:</span>
                  <input
                    type="text"
                    placeholder="e.g. festive_offer_2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Lowercase letters, numbers, and underscores only.</span>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">Category:</span>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-bold focus:outline-none"
                  >
                    <option value="MARKETING">MARKETING</option>
                    <option value="UTILITY">UTILITY</option>
                    <option value="AUTHENTICATION">AUTH / OTP</option>
                  </select>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">Language:</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold focus:outline-none"
                  >
                    <option value="en_US">English (en_US)</option>
                    <option value="hi">Hindi (hi)</option>
                    <option value="es">Spanish (es)</option>
                    <option value="ar">Arabic (ar)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Header Config */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold text-white uppercase tracking-wider">2. Header (Optional)</label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <select
                    value={headerFormat}
                    onChange={(e: any) => setHeaderFormat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none"
                  >
                    <option value="NONE">No Header</option>
                    <option value="TEXT">Text Header</option>
                    <option value="IMAGE">Image Header</option>
                    <option value="VIDEO">Video Header</option>
                    <option value="DOCUMENT">Document Header</option>
                  </select>
                </div>
                {headerFormat === 'TEXT' && (
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      placeholder="Header text e.g. Special Announcement"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 3. Body Text & Variables */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider">3. Body Message Content</label>
                <button
                  type="button"
                  onClick={handleAddVariableTag}
                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-mono transition-colors"
                >
                  + Add Variable Tag
                </button>
              </div>

              <textarea
                rows={4}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Write your main WhatsApp message text..."
                className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 leading-relaxed font-sans"
              />

              {/* Sample Variable Values Required by Meta */}
              {detectedVars.length > 0 && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                    <Info className="w-3.5 h-3.5" />
                    <span>Meta Sample Values (Required for Approval Evaluation)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {detectedVars.map((varNum) => (
                      <div key={varNum} className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-400 text-right w-12">{"{{" + varNum + "}}"}:</span>
                        <input
                          type="text"
                          placeholder={`Sample value for {{${varNum}}}`}
                          value={sampleValues[varNum] || ''}
                          onChange={(e) => setSampleValues({ ...sampleValues, [varNum]: e.target.value })}
                          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-sans focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Footer Text */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold text-white uppercase tracking-wider">4. Footer (Optional)</label>
              <input
                type="text"
                placeholder="Footer text e.g. Reply STOP to opt out"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* 5. Buttons */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white uppercase tracking-wider">5. Interactive Buttons (Max 3)</label>
                {buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    + Add Button
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {buttons.map((btn, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <select
                      value={btn.type}
                      onChange={(e: any) => {
                        const newBtns = [...buttons]
                        newBtns[idx].type = e.target.value
                        setButtons(newBtns)
                      }}
                      className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-semibold focus:outline-none"
                    >
                      <option value="QUICK_REPLY">Quick Reply</option>
                      <option value="URL">Visit URL</option>
                      <option value="PHONE_NUMBER">Call Phone</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Button Label"
                      value={btn.text}
                      onChange={(e) => {
                        const newBtns = [...buttons]
                        newBtns[idx].text = e.target.value
                        setButtons(newBtns)
                      }}
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none"
                    />

                    {btn.type === 'URL' && (
                      <input
                        type="url"
                        placeholder="https://example.com"
                        value={btn.url || ''}
                        onChange={(e) => {
                          const newBtns = [...buttons]
                          newBtns[idx].url = e.target.value
                          setButtons(newBtns)
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none"
                      />
                    )}

                    {btn.type === 'PHONE_NUMBER' && (
                      <input
                        type="text"
                        placeholder="+919876543210"
                        value={btn.phone_number || ''}
                        onChange={(e) => {
                          const newBtns = [...buttons]
                          newBtns[idx].phone_number = e.target.value
                          setButtons(newBtns)
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveButton(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Side: Live WhatsApp Message Card Preview */}
          <div className="lg:col-span-5 bg-[#0b141a] p-6 flex flex-col items-center justify-between relative overflow-y-auto">
            
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 pb-2 border-b border-slate-800">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Eye className="w-4 h-4" />
                  <span>WhatsApp Live Preview</span>
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  {category}
                </span>
              </div>

              {/* WhatsApp Green Card Bubble */}
              <div className="max-w-md mx-auto bg-[#005c4b] text-white rounded-2xl rounded-tr-none p-4 shadow-xl space-y-2 border border-emerald-600/40">
                
                {/* Header Preview */}
                {headerFormat === 'TEXT' && headerText && (
                  <h4 className="font-bold text-sm text-emerald-100">{headerText}</h4>
                )}
                {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (
                  <div className="w-full h-32 bg-slate-800/80 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs gap-1 border border-emerald-500/30">
                    <FileText className="w-6 h-6 text-emerald-400" />
                    <span>[{headerFormat} HEADER MEDIA]</span>
                  </div>
                )}

                {/* Body Preview */}
                <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-100">
                  {previewBody || 'Your template message body will appear here...'}
                </p>

                {/* Footer Preview */}
                {footerText && (
                  <p className="text-[10px] text-emerald-200/80 pt-1 border-t border-emerald-500/30">{footerText}</p>
                )}

                {/* Timestamp */}
                <div className="text-[9px] text-emerald-200/60 text-right">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* Buttons Preview */}
                {buttons.length > 0 && (
                  <div className="pt-2 space-y-1.5 border-t border-emerald-500/30">
                    {buttons.map((b, i) => (
                      <div key={i} className="py-1.5 text-center text-xs font-bold text-emerald-300 bg-black/20 hover:bg-black/30 rounded-xl border border-emerald-400/20 transition-colors cursor-default">
                        {b.text || `Button ${i + 1}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Submit Action */}
            <div className="w-full pt-6">
              <button
                type="button"
                onClick={handleSubmitToMeta}
                disabled={submitting}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{submitting ? 'Submitting to Meta...' : 'Submit Template to Meta'}</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
