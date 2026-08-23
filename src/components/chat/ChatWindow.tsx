'use client'

import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
import { Conversation } from '@/types'
import { useMessages, useSendMessage } from '@/hooks'
import { supabase } from '@/lib/supabaseClient'
import { useOrg } from '@/contexts/OrgContext'
import { formatDistanceToNow } from 'date-fns'
import { Send, Bot, User, Loader2, Paperclip, X, Tag, MessageSquare, Check, CheckCheck, Mic, Square, FileText, MapPin, Video, Image as ImageIcon, Headphones, User as UserIcon, Sparkles, ChevronUp, MessageCircle } from 'lucide-react'
import TemplatePickerModal from '@/components/chat/TemplatePickerModal'
import LocationPickerModal from '@/components/chat/LocationPickerModal'
import { CannedReplyItem } from '@/components/chat/CannedRepliesModal'

function formatMessageDateSeparator(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()

  if (isSameDay(date, today)) {
    return 'Today'
  } else if (isSameDay(date, yesterday)) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
  }
}

interface Props {
  conversation: Conversation | null
  onAIToggle: (id: string, mode: boolean) => void
}

export default function ChatWindow({ conversation, onAIToggle }: Props) {
  const { profile } = useOrg()
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const STAGES = ['new', 'interested', 'booking', 'confirmed', 'cancelled', 'completed', 'followup', 'not_interested', 'call_done', 'low_budget', 'hot_customer', 'not_connected'] as const
  const STAGE_COLORS: Record<string, string> = {
    new:        'bg-gray-100 text-gray-600',
    interested: 'bg-blue-100 text-blue-700',
    booking:    'bg-amber-100 text-amber-700',
    confirmed:  'bg-green-100 text-green-700',
    cancelled:  'bg-red-100 text-red-600',
    completed:  'bg-purple-100 text-purple-700',
   followup:      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  not_interested:'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      call_done:      'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
    low_budget:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
hot_customer:'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    not_connected:  'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',


  }

  const [stage, setStage] = useState(conversation?.stage || 'new')
  const [savingStage, setSavingStage] = useState(false)
  useEffect(() => {
    setStage(conversation?.stage || 'new')
  }, [conversation?.id, conversation?.stage])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  
  // Modals & Menus State
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)

  // Canned Replies & '/' Shortcut Popover State
  const [cannedReplies, setCannedReplies] = useState<CannedReplyItem[]>([])
  const [showCannedMenu, setShowCannedMenu] = useState(false)
  const [cannedSearch, setCannedSearch] = useState('')
  const [selectedCannedIdx, setSelectedCannedIdx] = useState(0)

  // Fetch Canned Replies for Org
  const fetchCannedReplies = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/canned-replies', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) setCannedReplies(data)
      }
    } catch (err) {
      console.error('Fetch canned replies error:', err)
    }
  }, [])

  useEffect(() => {
    fetchCannedReplies()
  }, [fetchCannedReplies, conversation?.id])
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const { messages, loading, bottomRef } = useMessages(conversation?.id || null)
  const { sendMessage, sending } = useSendMessage()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // File size limit removed temporarily

    setImageFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Audio Recording Functions
  const startRecording = async () => {
    try {
      if (!mediaRecorderRef.current) {
        const MicRecorder = (await import('mic-recorder-to-mp3')).default
        mediaRecorderRef.current = new MicRecorder({ bitRate: 128 })
      }

      await mediaRecorderRef.current!.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  // Check if 24h window is expired
  const is24hExpired = conversation?.last_incoming_message_at 
    ? (Date.now() - new Date(conversation.last_incoming_message_at).getTime() > 24 * 60 * 60 * 1000)
    : true

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      mediaRecorderRef.current.stop().getMp3().then(async ([buffer, blob]: any) => {
        const audioFile = new File(buffer, 'voicenote.mp3', {
          type: blob.type || 'audio/mpeg',
          lastModified: Date.now()
        })
        
        // Stop the active microphone stream
        const activeStream = mediaRecorderRef.current?.activeStream
        if (activeStream) {
          activeStream.getTracks().forEach((track: any) => track.stop())
        }
        
        await handleSendAudio(audioFile)
      }).catch((e: any) => console.error(e))
    }
  }

  const handleSendAudio = async (blob: Blob) => {
    if (!conversation) return
    setUploading(true)
    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('User organization not found')

      // Use .mp3 extension which WhatsApp natively supports for Voice Notes
      const filename = `${orgId}/${Date.now()}-voicenote.mp3`
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(filename, blob, { contentType: 'audio/mpeg', upsert: false })

      if (error) throw error

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filename)
      const mediaUrl = urlData.publicUrl

      await sendMessage(conversation.id, conversation.phone_number, '', mediaUrl, 'audio/mpeg')
    } catch (err) {
      console.error('Failed to send audio:', err)
      alert('Failed to send voice note.')
    } finally {
      setUploading(false)
    }
  }

  const handleSend = async () => {
    if (!conversation) return
    
    let mediaUrl = null
    let mediaType = null

    // Upload image if selected
    if (imageFile) {
      setUploading(true)
      try {
        const orgId = profile?.org_id
        if (!orgId) {
          throw new Error('User organization not found')
        }

        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(7)
        const extension = imageFile.name.split('.').pop()
        const filename = `${orgId}/${timestamp}-${randomStr}.${extension}`

        const { data, error } = await supabase.storage
          .from('chat-media')
          .upload(filename, imageFile, {
            contentType: imageFile.type,
            cacheControl: '3600',
            upsert: false
          })

        if (error) {
          throw error
        }

        const { data: urlData } = supabase.storage
          .from('chat-media')
          .getPublicUrl(filename)

        mediaUrl = urlData?.publicUrl || null
        mediaType = imageFile.type

        // Clear image after upload
        handleRemoveImage()
      } catch (err: any) {
        alert(err.message || 'Failed to upload image')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    // Send message (text and/or image)
    if (input.trim() || mediaUrl) {
      const success = await sendMessage(
        conversation.id,
        conversation.phone_number,
        input.trim(),
        mediaUrl,
        mediaType
      )
      
      if (success) {
        setInput('')
      }
    }
  }

  // Send Document Handler
  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !conversation) return
    setUploading(true)
    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('Organization not found')

      const ext = file.name.split('.').pop()
      const filename = `${orgId}/${Date.now()}-doc.${ext}`

      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(filename, file, { contentType: file.type, upsert: false })

      if (error) throw error

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filename)
      const mediaUrl = urlData.publicUrl

      await sendMessage(
        conversation.id,
        conversation.phone_number,
        '',
        mediaUrl,
        file.type || 'application/pdf',
        { filename: file.name, type: 'document' }
      )
    } catch (err: any) {
      alert(`Failed to send document: ${err.message || String(err)}`)
    } finally {
      setUploading(false)
      if (docInputRef.current) docInputRef.current.value = ''
    }
  }

  // Send Video Handler
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !conversation) return
    setUploading(true)
    try {
      const orgId = profile?.org_id
      if (!orgId) throw new Error('Organization not found')

      const ext = file.name.split('.').pop()
      const filename = `${orgId}/${Date.now()}-vid.${ext}`

      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(filename, file, { contentType: file.type, upsert: false })

      if (error) throw error

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filename)
      const mediaUrl = urlData.publicUrl

      await sendMessage(
        conversation.id,
        conversation.phone_number,
        '',
        mediaUrl,
        file.type || 'video/mp4'
      )
    } catch (err: any) {
      alert(`Failed to send video: ${err.message || String(err)}`)
    } finally {
      setUploading(false)
      if (videoInputRef.current) videoInputRef.current.value = ''
    }
  }

  // Send Location Handler
  const handleSendLocation = async (locData: { name: string; address: string; latitude: string; longitude: string }) => {
    if (!conversation) return
    await sendMessage(
      conversation.id,
      conversation.phone_number,
      `📍 ${locData.name}\n${locData.address}`,
      null,
      null,
      { type: 'location', location_data: locData }
    )
  }

  // Send Template Handler
  const handleSendTemplate = async (tplData: {
    template_name: string
    template_language: string
    template_components: any[]
    previewText: string
  }) => {
    if (!conversation) return
    await sendMessage(
      conversation.id,
      conversation.phone_number,
      tplData.previewText,
      null,
      null,
      {
        type: 'template',
        template_name: tplData.template_name,
        template_language: tplData.template_language,
        template_components: tplData.template_components
      }
    )
  }

  // Select & Send Canned Reply
  const handleSelectCannedReply = async (item: CannedReplyItem) => {
    if (!conversation) return
    setShowCannedMenu(false)
    setInput('')

    if (item.type === 'text') {
      await sendMessage(conversation.id, conversation.phone_number, item.content || '')
    } else if (item.type === 'location' && item.location_data) {
      await handleSendLocation({
        name: item.location_data.name || item.title || 'Location',
        address: item.location_data.address || '',
        latitude: item.location_data.latitude || '28.6139',
        longitude: item.location_data.longitude || '77.2090'
      })
    } else if (item.media_url) {
      const isDoc = item.type === 'document'
      await sendMessage(
        conversation.id,
        conversation.phone_number,
        item.content || '',
        item.media_url,
        isDoc ? 'application/pdf' : `${item.type}/jpeg`,
        isDoc ? { filename: item.filename || 'document.pdf', type: 'document' } : undefined
      )
    }
  }

  const filteredCannedReplies = cannedReplies.filter((r) =>
    r.shortcut.toLowerCase().includes(cannedSearch) ||
    (r.title && r.title.toLowerCase().includes(cannedSearch))
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

    if (val.startsWith('/') || val.includes(' /')) {
      if (cannedReplies.length === 0) {
        fetchCannedReplies()
      }
      const slashIndex = val.lastIndexOf('/')
      const searchPart = val.substring(slashIndex + 1).toLowerCase()
      setCannedSearch(searchPart)
      setShowCannedMenu(true)
      setSelectedCannedIdx(0)
    } else {
      setShowCannedMenu(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCannedMenu && filteredCannedReplies.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedCannedIdx((prev) => (prev + 1) % filteredCannedReplies.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedCannedIdx((prev) => (prev - 1 + filteredCannedReplies.length) % filteredCannedReplies.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = filteredCannedReplies[selectedCannedIdx] || filteredCannedReplies[0]
        if (selected) {
          handleSelectCannedReply(selected)
        }
        return
      }
      if (e.key === 'Escape') {
        setShowCannedMenu(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleAI = async () => {
    if (!conversation) return
    const newMode = !conversation.ai_mode
    await fetch('/api/takeover', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversation.id, ai_mode: newMode })
    })
    onAIToggle(conversation.id, newMode)
  }

  const handleStageChange = async (newStage: string) => {
    if (!conversation) return
    setSavingStage(true)
    setStage(newStage)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ stage: newStage })
      })
    } catch (err) {
      console.error('Failed to change stage:', err)
    } finally {
      setSavingStage(false)
    }
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950/40 p-8 select-none">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-150 dark:border-gray-800/80 flex items-center justify-center mx-auto shadow-sm">
            <MessageSquare className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-250">No Chat Selected</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">Select a conversation from the active queue on the left to start responding.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50/50 dark:bg-gray-950 min-h-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-150 dark:border-gray-800/85 bg-white dark:bg-gray-900 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight flex items-center gap-2">
            <span>{conversation.name}</span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              conversation.platform === 'instagram'
                ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 border border-pink-100/10'
                : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-100/10'
            }`}>
              {conversation.platform || 'whatsapp'}
            </span>
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{conversation.phone_number}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Stage Selector */}
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2.5 py-1.5 rounded-xl border border-gray-150 dark:border-gray-700/50 shadow-inner select-none">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={stage}
              onChange={(e) => handleStageChange(e.target.value)}
              disabled={savingStage}
              className={`text-[10px] uppercase font-bold tracking-wider px-1 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer disabled:opacity-50 ${STAGE_COLORS[stage]}`}
            >
              {STAGES.map(s => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* AI Toggle */}
          <button
            onClick={toggleAI}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 shadow-sm border flex items-center gap-1.5 ${
              conversation.ai_mode 
                ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600 shadow-emerald-500/20' 
                : 'bg-red-500 text-white border-red-400 hover:bg-red-600 shadow-red-500/20'
            }`}
          >
            {conversation.ai_mode ? (
              <>
                <Bot className="w-3.5 h-3.5" />
                AI ACTIVE
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5" />
                AI PAUSED
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/20 dark:bg-gray-950/10">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2 select-none">
            <MessageSquare className="w-8 h-8 opacity-20" />
            <p>No messages yet in this pipeline</p>
          </div>
        ) : (
          (() => {
            let lastDateStr = ''
            return messages.map((msg) => {
              const msgDate = new Date(msg.timestamp)
              const dateStr = msgDate.toDateString()
              const showSeparator = dateStr !== lastDateStr
              lastDateStr = dateStr

              return (
                <Fragment key={msg.id}>
                  {showSeparator && (
                    <div className="flex justify-center my-3 select-none">
                      <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-full shadow-sm">
                        {formatMessageDateSeparator(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[72%] ${msg.direction === 'outgoing' ? 'order-2' : 'order-1'}`}>
                      <div
                        className={`px-4 py-2.5 shadow-sm text-sm leading-relaxed ${
                          msg.direction === 'outgoing'
                            ? 'bg-emerald-500 text-white rounded-2xl rounded-tr-none'
                            : 'bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 text-gray-850 dark:text-gray-100 rounded-2xl rounded-tl-none'
                        }`}
                      >
                        {msg.media_url && msg.media_type?.startsWith('image') && (
                          <img
                            src={msg.media_url}
                            alt="Media attachment"
                            className="rounded-xl mb-2 max-w-full h-auto border border-gray-100 dark:border-gray-800"
                          />
                        )}

                        {msg.media_url && msg.media_type?.startsWith('audio') && (
                          <audio
                            controls
                            src={msg.media_url}
                            className="max-w-[200px] sm:max-w-[250px] mb-2 outline-none"
                          />
                        )}

                        {msg.message && (
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        )}
                      </div>

                      <div className={`flex items-center gap-1 text-[10px] text-gray-400 mt-1.5 px-1 font-semibold tracking-wide ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                        <span>{msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.direction === 'outgoing' && (
                          <span className="ml-0.5">
                            {msg.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : msg.status === 'failed' ? (
                              <X className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Fragment>
              )
            })
          })()
        )}

        <div ref={bottomRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-5 py-3 border-t border-gray-150 dark:border-gray-800/80 bg-gray-50 dark:bg-gray-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0 select-none">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500 shadow-md"
              />

              <button
                onClick={handleRemoveImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-650 rounded-full flex items-center justify-center text-white shadow-sm transition-all duration-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{imageFile?.name}</p>
              <p className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">{(imageFile!.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="relative px-5 py-4 border-t border-gray-150 dark:border-gray-800/85 bg-white dark:bg-gray-950 shrink-0">
        
        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="hidden"
        />
        <input
          type="file"
          ref={docInputRef}
          onChange={handleDocumentSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
        />
        <input
          type="file"
          ref={videoInputRef}
          onChange={handleVideoSelect}
          accept="video/*"
          className="hidden"
        />

        {/* Floating '/' Canned Replies Popover Menu (Matching Screenshot 2) */}
        {showCannedMenu && filteredCannedReplies.length > 0 && (
          <div className="absolute bottom-full left-5 right-5 mb-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto z-40 animate-in slide-in-from-bottom-2 duration-150">
            <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-[11px] font-bold text-slate-400">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Quick Canned Replies (Type / to filter)</span>
              </div>
              <span>{filteredCannedReplies.length} available</span>
            </div>
            <div className="p-1.5 space-y-1">
              {filteredCannedReplies.map((item, idx) => {
                const isSelected = idx === selectedCannedIdx
                return (
                  <button
                    key={item.id || item.shortcut + idx}
                    type="button"
                    onClick={() => handleSelectCannedReply(item)}
                    onMouseEnter={() => setSelectedCannedIdx(idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border border-emerald-500/40 text-white'
                        : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* WhatsApp Icon */}
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-white">/{item.shortcut}</span>
                          <span className="text-xs text-slate-400 truncate">{item.title}</span>
                        </div>
                        {item.content && (
                          <p className="text-[11px] text-slate-400 truncate max-w-md">{item.content}</p>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                      {item.type === 'location' ? 'LOCATION' : item.media_url ? 'CANNED' : 'QUICK'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* WhatsApp Attachment Popover Menu (Matching Screenshot 1) */}
        {showAttachmentMenu && (
          <div className="absolute bottom-full left-5 mb-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-40 w-56 animate-in fade-in duration-150">
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false)
                  setShowTemplateModal(true)
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 flex items-center gap-3 transition-colors"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Template</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false)
                  fileInputRef.current?.click()
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 flex items-center gap-3 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-blue-400" />
                <span>Image</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false)
                  videoInputRef.current?.click()
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 flex items-center gap-3 transition-colors"
              >
                <Video className="w-4 h-4 text-purple-400" />
                <span>Video</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false)
                  docInputRef.current?.click()
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 flex items-center gap-3 transition-colors"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Document</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false)
                  startRecording()
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 flex items-center gap-3 transition-colors"
              >
                <Headphones className="w-4 h-4 text-pink-400" />
                <span>Audio</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(false)
                  setShowLocationModal(true)
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 flex items-center gap-3 transition-colors"
              >
                <MapPin className="w-4 h-4 text-red-400" />
                <span>Location</span>
              </button>
            </div>
          </div>
        )}

        {(() => {
          const hasIncomingDate = !!conversation?.last_incoming_message_at;
          const lastIncoming = hasIncomingDate ? new Date(conversation.last_incoming_message_at!) : null;
          const hoursLeft = lastIncoming ? 24 - (new Date().getTime() - lastIncoming.getTime()) / (1000 * 60 * 60) : 24;
          const isExpired = lastIncoming ? hoursLeft <= 0 : false;

          if (isExpired) {
            return (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-2xl gap-3">
                <div className="text-center sm:text-left">
                  <span className="text-sm font-bold text-red-600 dark:text-red-400 block">24-Hour Messaging Window Expired</span>
                  <span className="text-xs font-medium text-red-500/80 dark:text-red-400/80 mt-0.5 block">
                    Freeform text messages are blocked by Meta. Send an approved Template Message to re-open the 24h window.
                  </span>
                </div>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0 transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>Send Template</span>
                </button>
              </div>
            );
          }

          return (
            <>
              {hasIncomingDate ? (
                hoursLeft > 0 && (
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      24h Window Active
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowTemplateModal(true)}
                        className="text-[11px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 hover:underline"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Send Template</span>
                      </button>
                      <span className={`text-[10px] font-bold ${hoursLeft < 2 ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>
                        {Math.floor(hoursLeft)}h {Math.floor((hoursLeft % 1) * 60)}m left
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    24h Window Tracking (New)
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowTemplateModal(true)}
                      className="text-[11px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 hover:underline"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Send Template</span>
                    </button>
                    <span className="text-[10px] font-bold text-gray-500">
                      Waiting for next customer reply to start timer...
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-2.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white focus-within:border-transparent">
                
                {/* Paperclip Attachment Menu Trigger (Matching Screenshot 1) */}
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  disabled={uploading || sending || !!imageFile}
                  className={`p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750 disabled:opacity-50 border border-gray-150 dark:border-gray-700/50 shadow-sm transition-all shrink-0 ${
                    showAttachmentMenu ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-white dark:bg-gray-800'
                  }`}
                  title="Attachment Options"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {isRecording ? (
                  <div className="flex-1 flex items-center gap-3 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={stopRecording}
                      className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-800/60 text-red-600 dark:text-red-400 transition-colors"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message or / for Canned Replies..."
                      rows={1}
                      className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none resize-none leading-relaxed px-2 py-1"
                      style={{ minHeight: '32px', maxHeight: '120px' }}
                    />

                    {!input.trim() && !imageFile && (
                      <button
                        onClick={startRecording}
                        disabled={sending || uploading}
                        className="p-2 rounded-xl bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-750 hover:text-emerald-500 disabled:opacity-50 border border-gray-150 dark:border-gray-700/50 shadow-sm transition-colors shrink-0"
                        title="Record Voice Note"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={handleSend}
                      disabled={(!input.trim() && !imageFile) || sending || uploading}
                      className="p-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all shrink-0"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </>
          );
        })()}
      </div>

      {/* Template Picker Modal */}
      <TemplatePickerModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSendTemplate={handleSendTemplate}
      />

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSendLocation={handleSendLocation}
      />
    </div>
  )
}
