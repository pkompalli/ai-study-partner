import { createServiceClient } from '@/lib/supabase/server'

export interface ExamDateRow {
  id: string
  user_id: string
  course_id: string
  label: string
  exam_date: string
  notes: string | null
  chapter_ids: string[]   // empty array = ALL chapters
  created_at: string
  updated_at: string
}

export async function listExamDates(userId: string): Promise<ExamDateRow[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exam_dates')
    .select('*')
    .eq('user_id', userId)
    .order('exam_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as ExamDateRow[]
}

export async function listExamDatesForCourse(userId: string, courseId: string): Promise<ExamDateRow[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exam_dates')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .order('exam_date', { ascending: true })
  if (error) throw error
  return (data ?? []) as ExamDateRow[]
}

export async function upsertExamDate(params: {
  id?: string
  userId: string
  courseId: string
  label: string
  examDate: string
  notes?: string
  chapterIds?: string[]   // empty array = ALL chapters
}): Promise<ExamDateRow> {
  const supabase = await createServiceClient()

  const row = {
    ...(params.id ? { id: params.id } : {}),
    user_id: params.userId,
    course_id: params.courseId,
    label: params.label,
    exam_date: params.examDate,
    notes: params.notes || null,
    chapter_ids: params.chapterIds ?? [],
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('exam_dates')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as ExamDateRow
}

export async function deleteExamDate(id: string, userId: string): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('exam_dates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}
