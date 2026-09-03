'use client'

import { supabase } from '@/lib/supabaseClient'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useOrg } from '@/contexts/OrgContext'
import { useTheme } from 'next-themes'

export const dynamic = 'force-dynamic'

import ConversationList from '@/components/chat/ConversationList'
import ChatWindow from '@/components/chat/ChatWindow'
import LeadPanel from '@/components/chat/LeadPanel'
import Sidebar from '@/components/Sidebar'

import { Conversation, Lead } from '@/types'

import {
  MessageSquare,
  Moon,
  Sun,
  ArrowLeft,
  Info
} from 'lucide-react'

type MobileView = 'list' | 'chat' | 'lead'

function ChatsPageContent() {
  const {
    org,
    profile,
    signOut,
    user,
    loading
  } = useOrg()

  const router = useRouter()
  const searchParams = useSearchParams()
  const phone = searchParams.get('phone')

  const { theme, setTheme } = useTheme()
  const dark = theme === 'dark'

  const [selected, setSelected] = useState<Conversation | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)

  const [mobileView, setMobileView] =
    useState<MobileView>('list')

  // Auth protection
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const handleSelect = useCallback(async (conv: Conversation) => {
    setSelected(conv)
    setMobileView('chat')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/leads?conversation_id=${conv.id}`, {
        headers: session?.access_token
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {}
      })
      if (res.ok) {
        const data = await res.json()
        setLead(data && data.id ? data : null)
      }
    } catch {
      setLead(null)
    }
  }, [])

  // Auto-focus selected lead's chat from URL query parameter
  useEffect(() => {
    if (!org?.id || !phone) return

    const loadDirectConversation = async () => {
      try {
        const isStaff = profile?.role !== 'admin' && profile?.role !== 'owner'
        let query = supabase
          .from('conversations')
          .select('*')
          .eq('org_id', org.id)
          .eq('phone_number', phone)

        if (isStaff && profile?.id) {
          query = query.eq('assigned_to', profile.id)
        }

        const { data, error } = await query.maybeSingle()

        if (error) throw error
        if (data) {
          handleSelect(data)
        }
      } catch (err) {
        console.error('Failed to auto-select conversation by phone:', err)
      }
    }

    loadDirectConversation()
  }, [phone, org?.id, profile, handleSelect])

  const handleLeadUpdate = useCallback(
    (updates: Partial<Lead>) => {
      setLead(prev => prev ? { ...prev, ...updates } : (updates as Lead))
    },
    []
  )

  const handleDelete = useCallback(
    (id: string) => {
      if (selected?.id === id) {
        setSelected(null)
        setMobileView('list')
      }
    },
    [selected?.id]
  )

  // Loading screen
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Prevent rendering before redirect
  if (!user) return null

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50/50 dark:bg-gray-950">

      {/* Top bar */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 shrink-0 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Sidebar />
          {mobileView !== 'list' && (
            <button
              onClick={() =>
                setMobileView(
                  mobileView === 'lead'
                    ? 'chat'
                    : 'list'
                )
              }
              className="p-2 rounded-xl bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-150 dark:border-gray-700/50 md:hidden transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-500 shrink-0" />
            <h1 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              {mobileView === 'list' && (org?.name || 'Inbox Chats')}
              {mobileView === 'chat' && (selected?.name || 'Chat')}
              {mobileView === 'lead' && 'Lead Info'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Lead info button on mobile */}
          {mobileView === 'chat' && selected && (
            <button
              onClick={() => setMobileView('lead')}
              className="p-2 rounded-xl bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-150 dark:border-gray-700/50 md:hidden transition-colors"
              title="View lead info"
            >
              <Info className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setTheme(dark ? 'light' : 'dark')}
            className="p-2 rounded-xl bg-gray-50 dark:bg-gray-850 hover:bg-gray-150 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-150 dark:border-gray-700/50 transition-colors"
          >
            {dark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Conversation list */}
        <div
          className={`
            flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-800
            ${mobileView === 'list' ? 'flex' : 'hidden'}
            md:flex md:w-80 md:shrink-0
            w-full
          `}
        >
          <ConversationList
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        </div>

        {/* CENTER: Chat window */}
        <div
          className={`
            flex-1 flex flex-col overflow-hidden min-w-0
            ${mobileView === 'chat' ? 'flex' : 'hidden'}
            md:flex
          `}
        >
          <ChatWindow
            conversation={selected}
            onAIToggle={(id, mode) => {
              if (selected?.id === id) {
                setSelected(prev =>
                  prev
                    ? {
                        ...prev,
                        ai_mode: mode
                      }
                    : null
                )
              }
            }}
          />
        </div>

        {/* RIGHT: Lead panel */}
        <div
          className={`
            flex flex-col overflow-hidden border-l border-gray-200 dark:border-gray-800
            ${mobileView === 'lead' ? 'flex' : 'hidden'}
            md:flex md:w-72 md:shrink-0
            w-full
          `}
        >
          <LeadPanel
            conversation={selected}
            lead={lead}
            onLeadUpdate={handleLeadUpdate}
          />
        </div>
      </div>

      {/* MOBILE: Bottom nav */}
      {selected && (
        <div className="md:hidden flex border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">

          <button
            onClick={() =>
              setMobileView('list')
            }
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              mobileView === 'list'
                ? 'text-emerald-600 border-t-2 border-emerald-500'
                : 'text-gray-500'
            }`}
          >
            Inbox
          </button>

          <button
            onClick={() =>
              setMobileView('chat')
            }
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              mobileView === 'chat'
                ? 'text-emerald-600 border-t-2 border-emerald-500'
                : 'text-gray-500'
            }`}
          >
            Chat
          </button>

          <button
            onClick={() =>
              setMobileView('lead')
            }
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              mobileView === 'lead'
                ? 'text-emerald-600 border-t-2 border-emerald-500'
                : 'text-gray-500'
            }`}
          >
            Lead Info
          </button>
        </div>
      )}
    </div>
  )
}

export default function ChatsPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-955">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChatsPageContent />
    </Suspense>
  )
}
