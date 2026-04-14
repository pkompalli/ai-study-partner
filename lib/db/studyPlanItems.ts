import { createServiceClient } from '@/lib/supabase/server'

export interface StudyPlanItemRow {
  id: string
  user_id: string
  course_id: string
  subject_id: string
  topic_id: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  status: 'suggested' | 'scheduled' | 'completed' | 'skipped'
  source: 'auto' | 'user'
  created_at: string
  updated_at: string
}

export async function listStudyPlanItems(userId: string, date?: string): Promise<StudyPlanItemRow[]> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('study_plan_items')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })

  if (date) {
    query = query.eq('scheduled_date', date)
  } else {
    query = query.gte('scheduled_date', new Date().toISOString().slice(0, 10))
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as StudyPlanItemRow[]
}

export async function upsertStudyPlanItems(
  userId: string,
  items: Array<{
    courseId: string
    subjectId: string
    topicId: string
    scheduledDate: string
    scheduledTime: string
    durationMinutes: number
    source?: 'auto' | 'user'
  }>
): Promise<StudyPlanItemRow[]> {
  if (items.length === 0) return []
  const supabase = await createServiceClient()

  const rows = items.map(item => ({
    user_id: userId,
    course_id: item.courseId,
    subject_id: item.subjectId,
    topic_id: item.topicId,
    scheduled_date: item.scheduledDate,
    scheduled_time: item.scheduledTime,
    duration_minutes: item.durationMinutes,
    source: item.source ?? 'auto',
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('study_plan_items')
    .upsert(rows, { onConflict: 'user_id,topic_id,scheduled_date' })
    .select()

  if (error) throw error
  return (data ?? []) as StudyPlanItemRow[]
}

export async function updateStudyPlanItem(
  id: string,
  userId: string,
  patch: {
    scheduledDate?: string
    scheduledTime?: string
    durationMinutes?: number
    status?: string
  }
): Promise<StudyPlanItemRow> {
  const supabase = await createServiceClient()

  const update: Record<string, unknown> = {
    source: 'user',
    updated_at: new Date().toISOString(),
  }
  if (patch.scheduledDate !== undefined) update.scheduled_date = patch.scheduledDate
  if (patch.scheduledTime !== undefined) update.scheduled_time = patch.scheduledTime
  if (patch.durationMinutes !== undefined) update.duration_minutes = patch.durationMinutes
  if (patch.status !== undefined) update.status = patch.status

  const { data, error } = await supabase
    .from('study_plan_items')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data as StudyPlanItemRow
}

export async function deleteStudyPlanItem(id: string, userId: string): Promise<void> {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('study_plan_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

/** Mark the study plan item for this topic on today's date as completed */
export async function markStudyPlanCompleted(userId: string, topicId: string): Promise<void> {
  const supabase = await createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  await supabase
    .from('study_plan_items')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .eq('scheduled_date', today)
    .in('status', ['suggested', 'scheduled'])
}
