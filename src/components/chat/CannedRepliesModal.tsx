'use client'

import { useState, useEffect } from 'react'
import { X, Upload, Image as ImageIcon, Video, FileText, Type, MapPin, Phone, MessageSquare, Loader2, Check, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'

export interface CannedReplyItem {
  id?: string
  shortcut: string
  title?: string
  type: 'text' | 'image' | 'video' | 'document' | 'location' | 'contact'
  content?: string
  media_url?: string | null
  filename?: string | null
  location_data?: {
    latitude?: string
    longitude?: string
    name?: string
    address?: string
  } | null
}

interface CannedRepliesModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (cannedItem: CannedReplyItem) => Promise<void>
  initialData?: CannedReplyItem | null
}

export default function CannedRepliesModal({
  isOpen,
  onClose,
  onSave,
  initialData
}: CannedRepliesModalProps) {
  const { profile } = useOrg()
  const [shortcut, setShortcut] = useState('')
  const [title, setTitle] = useState('')
  const [msgType, setMsgType] = useState<'text' | 'media' | 'location' | 'contact'>('media')
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document'>('image')
  
  const [content, setContent] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [filename, setFilename] = useState('')
  const [locName, setLocName] = useState('')
  const [locAddress, setLocAddress] = useState('')
  const [locLat, setLocLat] = useState('28.6139')
  const [locLng, setLocLng] = useState('77.2090')

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialData) {
      setShortcut(initialData.shortcut || '')
      setTitle(initialData.title || initialData.shortcut || '')
      setContent(initialData.content || '')
      setMediaUrl(initialData.media_url || '')
      setFilename(initialData.filename || '')
      if (initialData.type === 'location') {
        setMsgType('location')
        if (initialData.location_data) {
          setLocName(initialData.location_data.name || '')
          setLocAddress(initialData.location_data.address || '')
          setLocLat(initialData.location_data.latitude || '28.6139')
          setLocLng(initialData.location_data.longitude || '77.2090')
        }
      } else if (initialData.type === 'image' || initialData.type === 'video' || initialData.type === 'document') {
        setMsgType('media')
        setMediaType(initialData.type)
      } else {
        setMsgType('text')
      }
    } else {
      setShortcut('')
      setTitle('')
      setContent('')
      setMediaUrl('')
      setFilename('')
      setMsgType('media')
      setMediaType('image')
    }
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const orgId = profile?.org_id || 'default'
      const ext = file.name.split('.').pop()
      const path = `${orgId}/canned-${Date.now()}.${ext}`

      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(path, file, { contentType: file.type, upsert: true })

      if (error) throw error

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path)
      setMediaUrl(urlData.publicUrl)
      setFilename(file.name)
    } catch (err: any) {
      console.error('File upload error:', err)
      alert(`Upload failed: ${err.message || String(err)}`)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    const cleanShortcut = shortcut.replace(/^\//, '').trim().toLowerCase()
    if (!cleanShortcut) {
      alert('Please provide a shortcut name (e.g. charbi_ki_ganth)')
      return
    }

    let finalType: 'text' | 'image' | 'video' | 'document' | 'location' | 'contact' = 'text'
    if (msgType === 'media') {
      finalType = mediaType
    } else if (msgType === 'location') {
      finalType = 'location'
    } else if (msgType === 'contact') {
      finalType = 'contact'
    }

    setSaving(true)
    try {
      await onSave({
        id: initialData?.id,
        shortcut: cleanShortcut,
        title: title || cleanShortcut,
        type: finalType,
        content,
        media_url: mediaUrl || null,
        filename: filename || null,
        location_data: finalType === 'location' ? {
          name: locName,
          address: locAddress,
          latitude: locLat,
          longitude: locLng
        } : null
      })
      onClose()
    } catch (err: any) {
      console.error('Canned reply save error:', err)
      alert(`Failed to save canned reply: ${err.message || String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        
        {/* Top Header Matching Screenshot 3 */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">
              {initialData ? 'Edit Canned Reply' : 'Create Canned Reply'}
            </h2>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Canned Reply
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-slate-300">

          {/* Shortcut Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200">Shortcut Key (Trigger with /):</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono font-bold">/</span>
              <input
                type="text"
                placeholder="e.g. charbi_ki_ganth, gall_stone, gas_kabz"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500">Typing /{shortcut || 'shortcut'} in the chat input will open this quick reply.</p>
          </div>

          {/* Display Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-200">Title / Label:</label>
            <input
              type="text"
              placeholder="e.g. Charbi Ki Ganth (Fatty Tumor)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Message Type Selector Buttons (Matching Screenshot 3) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200">Message Type:</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMsgType('text')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                  msgType === 'text'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Type className="w-3.5 h-3.5" /> Text
              </button>
              <button
                type="button"
                onClick={() => setMsgType('media')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                  msgType === 'media'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Media
              </button>
              <button
                type="button"
                onClick={() => setMsgType('location')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                  msgType === 'location'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" /> Location
              </button>
            </div>
          </div>

          {/* Sub-Media Type Selector (If Media Selected) */}
          {msgType === 'media' && (
            <div className="space-y-2 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <label className="text-xs font-semibold text-slate-300">Media Type:</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMediaType('image')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                    mediaType === 'image'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Image
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('video')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                    mediaType === 'video'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" /> Video
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('document')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
                    mediaType === 'document'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Document
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="mt-3">
                <label className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-all">
                  {uploading ? (
                    <div className="flex items-center gap-2 text-blue-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs">Uploading media...</span>
                    </div>
                  ) : mediaUrl ? (
                    <div className="text-center space-y-1">
                      <Check className="w-6 h-6 text-emerald-400 mx-auto" />
                      <p className="text-xs text-white font-medium truncate max-w-xs">{filename || mediaUrl}</p>
                      <span className="text-[11px] text-blue-400 underline">Click to replace media</span>
                    </div>
                  ) : (
                    <div className="text-center space-y-1">
                      <Upload className="w-6 h-6 text-slate-500 mx-auto" />
                      <p className="text-xs text-slate-300 font-medium">Click to upload {mediaType}</p>
                      <p className="text-[10px] text-slate-500">Supports JPG, PNG, MP4, PDF files</p>
                    </div>
                  )}
                  <input type="file" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* Location Fields */}
          {msgType === 'location' && (
            <div className="space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Location Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Kartik Herbal Remedies Clinic"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Address:</label>
                <input
                  type="text"
                  placeholder="e.g. Main Market, Opposite Bus Stand"
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Latitude:</label>
                  <input
                    type="text"
                    value={locLat}
                    onChange={(e) => setLocLat(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Longitude:</label>
                  <input
                    type="text"
                    value={locLng}
                    onChange={(e) => setLocLng(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Caption Textarea (Matching Screenshot 3) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                {msgType === 'text' ? 'Message Content:' : 'Caption (Optional):'}
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {content.length}/1024
              </span>
            </div>
            <textarea
              rows={4}
              placeholder="1 🌿 मक्के / फिश्चर&#10;✔️ 3-4 महीने का कोर्स&#10;✔️ दर्द में राहत"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
            />
          </div>

          {/* Live Preview Box (Matching Screenshot 3) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Preview</span>
            </div>
            <div className="bg-[#0b141a] p-4 rounded-xl border border-slate-800">
              <div className="bg-[#005c4b] text-white p-3.5 rounded-xl rounded-tl-none shadow-md max-w-sm space-y-2 text-xs">
                {msgType === 'media' && mediaUrl && (
                  <div className="rounded-lg overflow-hidden border border-emerald-600/30">
                    {mediaType === 'image' ? (
                      <img src={mediaUrl} alt="Preview" className="w-full max-h-48 object-cover rounded-lg" />
                    ) : (
                      <div className="p-3 bg-black/30 text-center text-xs text-emerald-200 font-mono">
                        [{mediaType.toUpperCase()}: {filename || 'File'}]
                      </div>
                    )}
                  </div>
                )}

                {msgType === 'location' && (
                  <div className="flex items-center gap-2 p-2 bg-black/20 rounded-lg">
                    <MapPin className="w-4 h-4 text-emerald-300 shrink-0" />
                    <div>
                      <div className="font-bold">{locName || 'Location'}</div>
                      <div className="text-[10px] text-emerald-200">{locAddress}</div>
                    </div>
                  </div>
                )}

                {content && <p className="whitespace-pre-wrap leading-relaxed">{content}</p>}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Save Canned Reply</span>
          </button>
        </div>

      </div>
    </div>
  )
}
