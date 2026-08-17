import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
})

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
})

// Helper: get current user's org_id from session
export async function getOrgId(req: Request): Promise<string | null> {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const cookieStore = {
      get: (name: string) => {
        const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`))
        return match ? { value: decodeURIComponent(match[1]) } : undefined
      }
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          cookie: cookieHeader
        }
      }
    })

    const authHeader = req.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data } = await supabaseAdmin.auth.getUser(token)
      userId = data.user?.id || null
    }

    if (!userId) {
      // Try from cookie session
      const cookieStr = req.headers.get('cookie') || ''
      // Get the specific project ID from supabaseUrl
      const projectId = supabaseUrl.replace('https://', '').split('.')[0]
      const tokenMatch = cookieStr.match(new RegExp(`sb-${projectId}-auth-token=([^;]+)`))
      if (tokenMatch) {
        const token = decodeURIComponent(tokenMatch[1])
        try {
          const parsed = JSON.parse(token)
          const accessToken = parsed.access_token || parsed[0]?.access_token
          if (accessToken) {
            const { data } = await supabaseAdmin.auth.getUser(accessToken)
            userId = data.user?.id || null
          }
        } catch {}
      }
    }

    if (!userId) return null

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('org_id')
      .eq('id', userId)
      .single()

    return profile?.org_id || null
  } catch {
    return null
  }
}

const voiceSupabaseUrl = process.env.NEXT_PUBLIC_VOICE_SUPABASE_URL
const voiceSupabaseAnonKey = process.env.NEXT_PUBLIC_VOICE_SUPABASE_ANON_KEY
const voiceSupabaseServiceKey = process.env.VOICE_SUPABASE_SERVICE_ROLE_KEY || voiceSupabaseAnonKey

export const supabaseVoice = voiceSupabaseUrl && voiceSupabaseAnonKey
  ? createClient(voiceSupabaseUrl, voiceSupabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null

export const supabaseVoiceAdmin = voiceSupabaseUrl && voiceSupabaseServiceKey
  ? createClient(voiceSupabaseUrl, voiceSupabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : null