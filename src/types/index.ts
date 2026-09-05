export interface Conversation {
  id: string
  org_id?: string
  phone_number: string
  name?: string
  last_message?: string
  unread_count: number
  ai_mode: boolean
  stage: string
  notes?: string
  assigned_to?: string | null
  assignment_status?: string
  created_at: string
  updated_at: string
  platform?: string
  receiver_phone_number?: string
  last_incoming_message_at?: string
}

export type Stage =
  | 'new'
  | 'interested'
  | 'booking'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'followup'
  | 'not_interested'
  | 'call_done'
  | 'low_budget'
  | 'hot_customer'
  | 'not_connected'
  | 'joined'
  | 'not_joined'
  | 'unknown'

export interface Message {
  id: string
  conversation_id: string
  org_id?: string
  phone_number: string
  message?: string
  direction: 'incoming' | 'outgoing'
  timestamp: string
  media_url?: string | null
  media_type?: string | null
  created_at: string
  platform?: string
  status?: string // 'sent', 'delivered', 'read', 'failed'
  provider_message_id?: string
}

export interface Lead {
  id?: string
  conversation_id?: string
  org_id?: string
  phone_number: string
  customer_name?: string
  name?: string
  lead_type?: string
  intent?: string
  previous_qualification?: string
  year_of_passing?: string
  work_experience?: string
  location?: string
  course_interest?: string
  lead_quality?: string
  lead_ready?: string
  send_prospectus?: string
  prospectus_type?: string
  summary?: string
  last_message?: string
  updated?: string
  created_at?: string
  city?: string
  machine_interest?: string
  callback_ready?: string
  conversation_summary?: string
  lead_score?: number
  lead_temperature?: string
  metadata?: Record<string, any>
  followup_date?: string
  followup_notes?: string
  followup_notified?: boolean
}

export interface LeadActivity {
  id: string
  lead_id: string
  activity_type: string
  description: string
  notes?: string
  created_at: string
}

export interface ReplyPayload {
  message: string
  conversation_id: string
  phone_number?: string
  media_url?: string | null
  media_type?: string | null
}

export interface Product {
  id: string
  org_id: string
  name: string
  price: number | null
  description: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}