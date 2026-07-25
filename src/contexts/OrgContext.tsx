'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  org_id: string
  email: string
  name: string
  role: 'owner' | 'admin' | 'employee'
}

interface Organization {
  id: string
  name: string
  slug: string
  logo_url?: string
  plan: string
  has_voice_ai?: boolean
  has_orders_crm?: boolean
  has_comments_crm?: boolean
  has_emails_crm?: boolean
}

interface OrgContextType {
  user: User | null
  profile: UserProfile | null
  org: Organization | null
  loading: boolean
  isAdmin: boolean
  isOwner: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const OrgContext = createContext<OrgContextType | undefined>(undefined)

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfileAndOrg(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfileAndOrg(session.user.id)
      } else {
        setProfile(null)
        setOrg(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfileAndOrg = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[OrgContext] session:', session?.access_token ? 'exists' : 'null')
      if (!session) {
        setLoading(false)
        return
      }
  
      const res = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
  
      console.log('[OrgContext] /api/me status:', res.status)
      const json = await res.json()
      console.log('[OrgContext] /api/me response:', json)
  
      if (!res.ok) throw new Error(json.error || 'Failed to fetch profile')
  
      setProfile(json.profile)
      setOrg(json.org)
    } catch (err) {
      console.error('[OrgContext] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[OrgContext] SignOut error:', err)
    }
    // Clear cookies
    try {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    } catch {}
    window.location.href = '/login'
  }


  return (
    <OrgContext.Provider value={{
      user,
      profile,
      org,
      loading,
      isAdmin: profile?.role === 'admin' || profile?.role === 'owner',
      isOwner: profile?.role === 'owner',
      signIn,
      signOut,
    }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const context = useContext(OrgContext)
  if (!context) throw new Error('useOrg must be used within OrgProvider')
  return context
}