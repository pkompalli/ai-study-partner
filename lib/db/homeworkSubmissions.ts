import { createServiceClient } from '@/lib/supabase/server'
import type { HomeworkFeedback } from '@/lib/llm/homeworkGenerator'

export interface HomeworkSubmissionRow {
  id: string
  user_id: string
  course_id: string
  session_id?: string
  topic_id?: string
  chapter_id?: string
  topic_name?: string
  chapter_name?: string
  score_estimate?: string
  num_questions: number
  num_correct: number
  feedback: HomeworkFeedback
  file_names: string[]
  created_at: string
}

export async function saveHomeworkSubmission(params: {
  userId: string
  courseId: string
  sessionId?: string
  topicId?: string
  chapterId?: string
  topicName?: string
  chapterName?: string
  feedback: HomeworkFeedback
  fileNames: string[]
}): Promise<HomeworkSubmissionRow> {
  const supabase = await createServiceClient()

  const numCorrect = params.feedback.questions?.filter(q => q.is_correct).length ?? 0

  const row = {
    user_id: params.userId,
    course_id: params.courseId,
    session_id: params.sessionId || null,
    topic_id: params.topicId || null,
    chapter_id: params.chapterId || null,
    topic_name: params.topicName || null,
    chapter_name: params.chapterName || null,
    score_estimate: params.feedback.score_estimate || null,
    num_questions: params.feedback.questions?.length ?? 0,
    num_correct: numCorrect,
    feedback: params.feedback,
    file_names: params.fileNames,
  }

  const { data, error } = await supabase
    .from('homework_submissions')
    .insert(row)
    .select()
    .single()

  if (error) {
    // FK constraint failure — retry without optional FK columns
    if (error.code === '23503') {
      console.warn('[saveHomeworkSubmission] FK constraint error, retrying without FK IDs:', error.message)
      const { data: retryData, error: retryErr } = await supabase
        .from('homework_submissions')
        .insert({ ...row, session_id: null, topic_id: null, chapter_id: null })
        .select()
        .single()
      if (retryErr) throw retryErr
      return retryData as HomeworkSubmissionRow
    }
    throw error
  }
  return data as HomeworkSubmissionRow
}

export async function listHomeworkSubmissions(params: {
  userId: string
  courseId: string
  topicId?: string
  chapterId?: string
  limit?: number
}): Promise<Omit<HomeworkSubmissionRow, 'feedback'>[]> {
  const supabase = await createServiceClient()

  let query = supabase
    .from('homework_submissions')
    .select('id, user_id, course_id, session_id, topic_id, chapter_id, topic_name, chapter_name, score_estimate, num_questions, num_correct, file_names, created_at')
    .eq('user_id', params.userId)
    .eq('course_id', params.courseId)
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 20)

  // Optionally filter by chapter/topic — but keep it simple
  if (params.chapterId) {
    query = query.eq('chapter_id', params.chapterId)
  } else if (params.topicId) {
    query = query.eq('topic_id', params.topicId)
  }
  // Note: if no results found with topic/chapter filter, caller should
  // retry without filters to catch submissions saved without FK IDs

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Omit<HomeworkSubmissionRow, 'feedback'>[]
}

export async function getHomeworkSubmission(id: string, userId: string): Promise<HomeworkSubmissionRow | null> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw error
  }
  return data as HomeworkSubmissionRow
}
