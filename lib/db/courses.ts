import { createServiceClient } from '@/lib/supabase/server'

export async function getCoursesByUser(userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      subjects (
        *,
        topics (
          *,
          chapters (*)
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getCourseById(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function createCourse(
  userId: string,
  input: {
    name: string
    description?: string
    goal: 'exam_prep' | 'classwork'
    exam_name?: string
    year_of_study?: string
    source_type?: string
    source_file_url?: string
    raw_input?: string
    structure?: unknown
  },
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCourse(
  id: string,
  userId: string,
  input: Partial<{
    name: string
    description: string
    goal: string
    exam_name: string
    year_of_study: string
    is_active: boolean
  }>,
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .update(input)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCourse(id: string, userId: string) {
  const supabase = await createServiceClient()

  // Verify ownership
  const { data: course, error: findErr } = await supabase
    .from('courses')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (findErr || !course) throw new Error('Course not found')

  // Helper: delete rows, log but don't throw on errors (table/column may not exist)
  const safeDel = async (table: string, column: string, value: string | string[]) => {
    try {
      let result
      if (Array.isArray(value)) {
        if (value.length === 0) return
        result = await supabase.from(table).delete().in(column, value)
      } else {
        result = await supabase.from(table).delete().eq(column, value)
      }
      if (result.error) {
        console.warn(`[deleteCourse] safeDel ${table}.${column} warning:`, result.error.message)
      }
    } catch (err) {
      console.warn(`[deleteCourse] safeDel ${table}.${column} exception:`, err)
    }
  }

  // Collect child IDs
  const subjectIds = ((await supabase.from('subjects').select('id').eq('course_id', id)).data ?? []).map(s => s.id)

  // topics may or may not have course_id column depending on DB state
  let topicIds: string[] = []
  if (subjectIds.length > 0) {
    topicIds = ((await supabase.from('topics').select('id').in('subject_id', subjectIds)).data ?? []).map(t => t.id)
  }

  const examIds = ((await supabase.from('exams').select('id').eq('course_id', id)).data ?? []).map(e => e.id)

  // Delete topic children (deepest level)
  if (topicIds.length > 0) {
    await Promise.all([
      safeDel('chapters', 'topic_id', topicIds),
      safeDel('flashcards', 'topic_id', topicIds),
      safeDel('flashcard_bank', 'topic_id', topicIds),
      safeDel('notes_meta', 'topic_id', topicIds),
      safeDel('notes', 'topic_id', topicIds),
      safeDel('lessons', 'topic_id', topicIds),
      safeDel('snippets', 'topic_id', topicIds),
      safeDel('questions', 'topic_id', topicIds),
      safeDel('anki_imported_flashcards', 'topic_id', topicIds),
      safeDel('test_topics', 'topic_id', topicIds),
      safeDel('probe_game', 'topic_id', topicIds),
      safeDel('word_group', 'topic_id', topicIds),
      safeDel('public_chats', 'topic_id', topicIds),
    ])
  }

  // Delete topics (via subject_id — topics may not have course_id)
  if (subjectIds.length > 0) {
    // Must delete topics AFTER their children above
    await safeDel('topics', 'subject_id', subjectIds)
  }

  // Delete other subject children
  if (subjectIds.length > 0) {
    await Promise.all([
      safeDel('flashcards', 'subject_id', subjectIds),
      safeDel('flashcard_bank', 'subject_id', subjectIds),
      safeDel('notes', 'subject_id', subjectIds),
      safeDel('lessons', 'subject_id', subjectIds),
      safeDel('snippets', 'subject_id', subjectIds),
      safeDel('anki_imported_flashcards', 'subject_id', subjectIds),
      safeDel('exam_subjects', 'subject_id', subjectIds),
      safeDel('daily_plan_subjects', 'subject_id', subjectIds),
    ])
  }

  // Delete exam children
  if (examIds.length > 0) {
    await Promise.all([
      safeDel('exam_subjects', 'exam_id', examIds),
      safeDel('lesson_schedule_exams', 'exam_id', examIds),
      safeDel('note_schedule_exams', 'exam_id', examIds),
      safeDel('probe_game_exams', 'exam_id', examIds),
      safeDel('schedule_config_exams', 'exam_id', examIds),
      safeDel('schedule_deck_config_exams', 'exam_id', examIds),
      safeDel('synapses_game_exams', 'exam_id', examIds),
      safeDel('test_template_config_exams', 'exam_id', examIds),
      safeDel('test_template_exams', 'exam_id', examIds),
      safeDel('user_exams', 'exam_id', examIds),
    ])
  }

  // Delete session messages before study_sessions (FK dependency)
  const sessionIds = ((await supabase.from('study_sessions').select('id').eq('course_id', id)).data ?? []).map(s => s.id)
  if (sessionIds.length > 0) {
    await safeDel('session_messages', 'session_id', sessionIds)
  }

  // Delete direct course children
  await Promise.all([
    safeDel('study_sessions', 'course_id', id),
    safeDel('topic_progress', 'course_id', id),
    safeDel('lesson_artifacts', 'course_id', id),
    safeDel('homework_submissions', 'course_id', id),
    safeDel('exam_formats', 'course_id', id),
    safeDel('exam_dates', 'course_id', id),
    safeDel('study_plan_items', 'course_id', id),
    safeDel('summary_cache', 'topic_id', topicIds.length > 0 ? topicIds : []),
    safeDel('subjects', 'course_id', id),
    safeDel('exams', 'course_id', id),
    safeDel('daily_plans', 'course_id', id),
    safeDel('user_courses', 'course_id', id),
    safeDel('lesson_themes', 'course_id', id),
    safeDel('year_of_study', 'course_id', id),
  ])

  // Nullify onboarding_sessions course_id (FK is ON DELETE SET NULL but do it explicitly)
  try {
    await supabase.from('onboarding_sessions').update({ course_id: null }).eq('course_id', id)
  } catch { /* ignore */ }

  // Delete the course
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getCourseWithTree(id: string, userId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .select(`
      *,
      subjects (
        *,
        topics (
          *,
          chapters (*)
        )
      )
    `)
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function getCourseContext(courseId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('courses')
    .select('name, goal, year_of_study, exam_name')
    .eq('id', courseId)
    .maybeSingle()
  if (error) throw error
  if (!data) return undefined
  return data
    ? {
        name: data.name,
        goal: data.goal,
        yearOfStudy: data.year_of_study ?? undefined,
        examName: data.exam_name ?? undefined,
      }
    : undefined
}
