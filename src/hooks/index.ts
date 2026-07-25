'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Conversation, Message } from '@/types'

// ----------------------------------------------------------------
// useConversations — fetches + subscribes to all conversations
// ----------------------------------------------------------------
export function useConversations(filters: {
  search?: string
  stage?: string
  unread?: boolean
  assignFilter?: string
  userId?: string
  isAdmin?: boolean
  userRole?: string
} = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)

  const fetchConversations = useCallback(async (showLoading = true) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || null
    tokenRef.current = token
    if (!token) { setLoading(false); return }
    if (showLoading) setLoading(true)

    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.stage)  params.set('stage',  filters.stage)
    if (filters.unread) params.set('unread', 'true')

    if (filters.userRole === 'employee' && filters.userId) {
      params.set('assigned_to', filters.userId)
    } else if (
      (filters.userRole === 'admin' || filters.userRole === 'owner') &&
      filters.assignFilter &&
      filters.assignFilter !== 'all'
    ) {
      params.set('assign_filter', filters.assignFilter)
    }

    const res = await fetch(`/api/conversations?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (Array.isArray(data)) {
      setConversations(data)
      if (data.length > 0 && data[0].org_id) setOrgId(data[0].org_id)
    }
    setLoading(false)
  }, [filters.search, filters.stage, filters.unread, filters.assignFilter, filters.userId, filters.userRole])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Realtime subscription filtered to this org only
  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`conversations-changes-${orgId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `org_id=eq.${orgId}`
      },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newConv = payload.new as Conversation
            setConversations(prev => {
              if (prev.some(c => c.id === newConv.id)) return prev
              return [newConv, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedConv = payload.new as Conversation
            setConversations(prev => {
              const list = prev.map(c => {
                if (c.id === updatedConv.id) {
                  // Defensive spreading to merge updated columns while preserving static fields
                  return { ...c, ...updatedConv }
                }
                return c
              })
              // Re-sort list by updated_at descending
              return [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            })
          } else if (payload.eventType === 'DELETE') {
            const oldConv = payload.old as Conversation
            setConversations(prev => prev.filter(c => c.id !== oldConv.id))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orgId])

  return { conversations, loading, refetch: fetchConversations }
}

// ----------------------------------------------------------------
// useMessages — fetches + subscribes to conversation messages
// ----------------------------------------------------------------
export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return

    try {
      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch(
        `/api/messages?conversation_id=${conversationId}`,
        {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        }
      )

      const data = await res.json()
      if (Array.isArray(data)) setMessages(data)
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    fetchMessages()
  }, [conversationId, fetchMessages])

  // Real-time message subscription
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Auto-scroll when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return { messages, loading, bottomRef, refetch: fetchMessages }
}

// ----------------------------------------------------------------
// useSendMessage — handles sending replies
// ----------------------------------------------------------------
export function useSendMessage() {
  const [sending, setSending] = useState(false)

  const sendMessage = useCallback(
    async (
      conversationId: string,
      phoneNumber: string,
      message: string,
      mediaUrl?: string | null,
      mediaType?: string | null
    ) => {
      if (!message.trim() && !mediaUrl) return false
      setSending(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            phone_number: phoneNumber,
            message: message.trim(),
            media_url: mediaUrl,
            media_type: mediaType,
          }),
        })
        return res.ok
      } catch (error) {
        console.error('Error sending message:', error)
        return false
      } finally {
        setSending(false)
      }
    },
    []
  )

  return { sendMessage, sending }
}

// ----------------------------------------------------------------
// useToggleAI — handles AI/human takeover toggle
// ----------------------------------------------------------------
export function useToggleAI() {
  const toggleAI = useCallback(
    async (conversationId: string, aiMode: boolean) => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/takeover', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            ai_mode: aiMode,
          }),
        })
      } catch (error) {
        console.error('Error toggling AI mode:', error)
      }
    },
    []
  )

  return { toggleAI }
}