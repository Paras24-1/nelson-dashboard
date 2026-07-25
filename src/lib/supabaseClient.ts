import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-only Supabase instances (Safe for client component bundling)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
})

const voiceSupabaseUrl = process.env.NEXT_PUBLIC_VOICE_SUPABASE_URL
const voiceSupabaseAnonKey = process.env.NEXT_PUBLIC_VOICE_SUPABASE_ANON_KEY

export const supabaseVoice = voiceSupabaseUrl && voiceSupabaseAnonKey
  ? createClient(voiceSupabaseUrl, voiceSupabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null
