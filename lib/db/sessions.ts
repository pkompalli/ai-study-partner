import { createServiceClient } from '@/lib/supabase/server'

export async function getSessionsByCourse(courseId: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('study_sessions')
    .select('id, course_id, topic_id, chapter_id, title, status, started_at, ended_at')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getSessionsByUser(userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('study_sessions')
    .select('id, course_id, topic_id, chapter_id, title, status, started_at, ended_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getSessionById(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function createSession(
  userId: string,
  input: {
    course_id: string
    topic_id?: string
    chapter_id?: string
    title?: string
  },
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSession(
  id: string,
  userId: string,
  input: Partial<{
    title: string
    status: string
    ended_at: string
    metadata: unknown
  }>,
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('study_sessions')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function endSession(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('study_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSession(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('study_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getSessionMessages(sessionId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('session_messages')
    .select('id, role, content, content_type, metadata, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  contentType = 'text',
  metadata: Record<string, unknown> = {},
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('session_messages')
    .insert({ session_id: sessionId, role, content, content_type: contentType, metadata })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getTopicProgress(userId: string, courseId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('topic_progress')
    .select('topic_id, status, last_studied')
    .eq('user_id', userId)
    .eq('course_id', courseId)
  if (error) throw error
  return Object.fromEntries(
    (data ?? []).map((r) => [r.topic_id, { status: r.status, last_studied: r.last_studied }]),
  )
}

export async function upsertTopicProgress(
  userId: string,
  topicId: string,
  courseId: string,
  status: string,
) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('topic_progress')
    .upsert(
      { user_id: userId, topic_id: topicId, course_id: courseId, status, last_studied: new Date().toISOString() },
      { onConflict: 'user_id,topic_id' },
    )
  if (error) throw error
}

export async function saveQuiz(
  sessionId: string,
  userId: string,
  topicId: string | undefined,
  questions: unknown,
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      session_id: sessionId,
      user_id: userId,
      topic_id: topicId ?? null,
      questions,
      total: (questions as unknown[]).length,
    })
    .select()
    .single()
  if (error) throw error
  return data.id as string
}

export async function getQuiz(quizId: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function submitQuizAnswers(
  quizId: string,
  userId: string,
  answers: Record<string, number>,
  score: number,
  total: number,
) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('quizzes')
    .update({ answers, score, total, completed_at: new Date().toISOString() })
    .eq('id', quizId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function saveFlashcardSet(
  sessionId: string,
  userId: string,
  topicId: string | undefined,
  cards: unknown,
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('flashcard_sets')
    .insert({ session_id: sessionId, user_id: userId, topic_id: topicId ?? null, cards })
    .select()
    .single()
  if (error) throw error
  return data.id as string
}
