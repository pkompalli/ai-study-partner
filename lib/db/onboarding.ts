import { createServiceClient } from '@/lib/supabase/server'
import type { OnboardingSession, OnboardingMessage, CollectedData } from '@/types/onboarding'

export async function createOnboardingSession(userId: string): Promise<OnboardingSession> {
  const supabase = await createServiceClient()

  // Abandon any existing active onboarding sessions
  await supabase
    .from('onboarding_sessions')
    .update({ status: 'abandoned', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active')

  const { data, error } = await supabase
    .from('onboarding_sessions')
    .insert({ user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data as OnboardingSession
}

export async function getOnboardingSession(id: string, userId: string): Promise<OnboardingSession> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data as OnboardingSession
}

export async function getActiveOnboardingSession(userId: string): Promise<OnboardingSession | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('onboarding_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as OnboardingSession | null
}

export async function updateOnboardingSession(
  id: string,
  patch: {
    current_layer?: number
    collected_data?: CollectedData
    status?: 'active' | 'completed' | 'abandoned'
    course_id?: string
  }
): Promise<OnboardingSession> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('onboarding_sessions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as OnboardingSession
}

export async function getOnboardingMessages(sessionId: string): Promise<OnboardingMessage[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('onboarding_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as OnboardingMessage[]
}

export async function saveOnboardingMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  contentType: 'text' | 'checkpoint' | 'tool_result' = 'text',
  metadata?: Record<string, unknown>
): Promise<OnboardingMessage> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('onboarding_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      content_type: contentType,
      metadata: metadata ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as OnboardingMessage
}
