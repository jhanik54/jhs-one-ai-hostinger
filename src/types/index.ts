export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  preferred_lang: 'en' | 'bn'
  theme: 'light' | 'dark'
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: number
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  attachments?: { id: string; filename: string; mime_type: string; type: 'pdf' | 'image' }[]
}

export interface AdminUser {
  id: string
  role: 'admin' | 'superadmin'
}

export interface AppSettings {
  active_providers: string[]
  admin_emails: string[]
  provider_weights: Record<string, number>
}

export interface ApiKeyEntry {
  key: string
  provider: string
  index: number
  used: number
  lastUsed: Date | null
  isActive: boolean
}

export interface ProviderLog {
  id: number
  provider: string
  user_id: string | null
  success: boolean
  response_time_ms: number | null
  error_message: string | null
  created_at: string
}

export type ProviderName = 'gemini' | 'groq' | 'openrouter'

export interface ChatRequest {
  message: string
  conversation_id: string | null
  request_id?: string
  file_ids?: string[]
}

export interface StreamChunk {
  type: 'text' | 'done' | 'error'
  content?: string
}

export interface DashboardStats {
  total_users: number
  total_messages: number
  total_conversations: number
  active_today: number
  messages_today: number
  messages_month?: number
  pending_subscriptions?: number
  uploads_today?: { pdfs: number; images: number }
  plan_distribution?: Record<string, number>
  provider_metrics?: { active_providers: number; configured_keys: number; requests_today: number; successes_today: number; failures_today: number }
  database?: 'connected'
}
