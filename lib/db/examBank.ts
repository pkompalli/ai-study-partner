import { createServiceClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarkCriterion {
  label: string
  description?: string
  marks: number
}

export interface ExamSection {
  id: string
  exam_format_id: string
  name: string
  question_type: 'mcq' | 'short_answer' | 'long_answer' | 'data_analysis' | 'calculation'
  num_questions: number
  marks_per_question?: number
  total_marks?: number
  instructions?: string
  sort_order: number
}

export interface ExamFormat {
  id: string
  user_id: string
  course_id: string
  name: string
  description?: string
  total_marks?: number
  time_minutes?: number
  instructions?: string
  created_at: string
  sections: ExamSection[]
  question_count: number
}

// ─── Exam Formats ─────────────────────────────────────────────────────────────

export async function getExamFormatsForCourse(userId: string, courseId: string): Promise<ExamFormat[]> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exam_formats')
    .select('*, exam_sections(*), exam_questions(count)')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((f: any) => ({
    ...f,
    question_count: f.exam_questions?.[0]?.count ?? 0,
    exam_questions: undefined,
    sections: (f.exam_sections ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    exam_sections: undefined,
  }))
}

export async function getExamFormat(formatId: string, userId: string): Promise<ExamFormat | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exam_formats')
    .select('*, exam_sections(*), exam_questions(count)')
    .eq('id', formatId)
    .eq('user_id', userId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return {
    ...data,
    question_count: data.exam_questions?.[0]?.count ?? 0,
    exam_questions: undefined,
    sections: ((data.exam_sections as ExamSection[]) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    exam_sections: undefined,
  }
}

export async function createExamFormat(
  userId: string,
  courseId: string,
  payload: {
    name: string
    description?: string
    total_marks?: number
    time_minutes?: number
    instructions?: string
    sections: Array<{
      name: string
      question_type: string
      num_questions: number
      marks_per_question?: number
      total_marks?: number
      instructions?: string
    }>
  },
): Promise<ExamFormat> {
  const supabase = await createServiceClient()

  const { data: fmt, error: fmtErr } = await supabase
    .from('exam_formats')
    .insert({
      name: payload.name,
      description: payload.description ?? null,
      total_marks: payload.total_marks ?? null,
      time_minutes: payload.time_minutes ?? null,
      instructions: payload.instructions ?? null,
      course_id: courseId,
      user_id: userId,
    })
    .select()
    .single()
  if (fmtErr) throw fmtErr

  const sectionRows = payload.sections.map((s, idx) => ({
    exam_format_id: fmt.id,
    name: s.name,
    question_type: s.question_type,
    num_questions: s.num_questions,
    marks_per_question: s.marks_per_question ?? null,
    total_marks: s.total_marks ?? null,
    instructions: s.instructions ?? null,
    sort_order: idx,
    user_id: userId,
  }))

  const { data: secs, error: secsErr } = await supabase
    .from('exam_sections')
    .insert(sectionRows)
    .select()
  if (secsErr) throw secsErr

  return { ...fmt, sections: secs ?? [], question_count: 0 }
}

export async function updateExamFormat(
  formatId: string,
  userId: string,
  payload: Partial<{
    name: string
    description: string
    total_marks: number
    time_minutes: number
    instructions: string
  }>,
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exam_formats')
    .update(payload)
    .eq('id', formatId)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function replaceSections(
  formatId: string,
  userId: string,
  sections: Array<{
    name: string
    question_type: string
    num_questions: number
    marks_per_question?: number
    total_marks?: number
    instructions?: string
  }>,
) {
  const supabase = await createServiceClient()

  // Verify ownership
  const { data: owns, error: ownsErr } = await supabase
    .from('exam_formats')
    .select('id')
    .eq('id', formatId)
    .eq('user_id', userId)
    .single()
  if (ownsErr || !owns) throw new Error('Format not found')

  // Delete existing sections
  const { error: delErr } = await supabase
    .from('exam_sections')
    .delete()
    .eq('exam_format_id', formatId)
  if (delErr) throw delErr

  // Insert new sections
  const sectionRows = sections.map((s, idx) => ({
    exam_format_id: formatId,
    name: s.name,
    question_type: s.question_type,
    num_questions: s.num_questions,
    marks_per_question: s.marks_per_question ?? null,
    total_marks: s.total_marks ?? null,
    instructions: s.instructions ?? null,
    sort_order: idx,
    user_id: userId,
  }))

  const { data, error } = await supabase
    .from('exam_sections')
    .insert(sectionRows)
    .select()
  if (error) throw error
  return data ?? []
}

export async function deleteExamFormat(formatId: string, userId: string) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('exam_formats')
    .delete()
    .eq('id', formatId)
    .eq('user_id', userId)
  if (error) throw error
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function getExamQuestions(formatId: string, sectionId?: string) {
  const supabase = await createServiceClient()
  let query = supabase
    .from('exam_questions')
    .select(`
      id, exam_format_id, section_id, topic_id, course_id,
      question_text, dataset, options, correct_option_index,
      max_marks, mark_scheme, depth, created_at,
      exam_sections!inner ( name, question_type, sort_order ),
      topics ( name )
    `)
    .eq('exam_format_id', formatId)
    .order('created_at', { ascending: true })

  if (sectionId) {
    query = query.eq('section_id', sectionId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    exam_format_id: r.exam_format_id,
    section_id: r.section_id,
    section_name: r.exam_sections?.name,
    section_question_type: r.exam_sections?.question_type,
    topic_id: r.topic_id ?? undefined,
    topic_name: r.topics?.name ?? undefined,
    course_id: r.course_id,
    question_text: r.question_text,
    dataset: r.dataset ?? undefined,
    options: r.options ?? undefined,
    correct_option_index: r.correct_option_index ?? undefined,
    max_marks: r.max_marks,
    mark_scheme: r.mark_scheme ?? [],
    depth: r.depth ?? 3,
  }))
}

export async function getExamQuestionById(questionId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exam_questions')
    .select(`
      id, exam_format_id, section_id, topic_id, course_id,
      question_text, dataset, options, correct_option_index,
      max_marks, mark_scheme, depth,
      exam_sections!inner ( name, question_type ),
      topics ( name )
    `)
    .eq('id', questionId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return {
    id: data.id,
    exam_format_id: (data as any).exam_format_id,
    section_id: data.section_id,
    section_name: (data as any).exam_sections?.name,
    section_question_type: (data as any).exam_sections?.question_type,
    topic_id: data.topic_id ?? undefined,
    topic_name: (data as any).topics?.name ?? undefined,
    course_id: data.course_id,
    question_text: data.question_text,
    dataset: (data as any).dataset ?? undefined,
    options: (data as any).options ?? undefined,
    correct_option_index: (data as any).correct_option_index ?? undefined,
    max_marks: (data as any).max_marks,
    mark_scheme: (data as any).mark_scheme ?? [],
    depth: (data as any).depth ?? 3,
  }
}

export async function saveExamQuestions(
  formatId: string,
  userId: string,
  courseId: string,
  questions: Array<{
    id?: string
    section_id: string
    topic_id?: string
    question_text: string
    dataset?: string
    options?: string[]
    correct_option_index?: number
    max_marks: number
    mark_scheme: MarkCriterion[]
    depth?: number
  }>,
) {
  const supabase = await createServiceClient()
  const rows = questions.map((q) => ({
    ...(q.id ? { id: q.id } : {}),
    exam_format_id: formatId,
    user_id: userId,
    section_id: q.section_id,
    topic_id: q.topic_id ?? null,
    course_id: courseId,
    question_text: q.question_text,
    dataset: q.dataset ?? null,
    options: q.options ?? null,
    correct_option_index: q.correct_option_index ?? null,
    max_marks: q.max_marks,
    mark_scheme: q.mark_scheme,
    depth: q.depth ?? 3,
  }))
  const { error } = await supabase.from('exam_questions').insert(rows)
  if (error) throw error
}

export async function deleteExamQuestions(formatId: string) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('exam_questions')
    .delete()
    .eq('exam_format_id', formatId)
  if (error) throw error
}

// ─── Attempts ─────────────────────────────────────────────────────────────────

export async function createAttempt(userId: string, formatId: string, mode: 'practice' | 'exam') {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exam_attempts')
    .insert({ user_id: userId, exam_format_id: formatId, mode })
    .select()
    .single()
  if (error) throw error
  return data.id as string
}

export async function getAttempt(attemptId: string, userId: string) {
  const supabase = await createServiceClient()
  const { data: attempt, error: attemptErr } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single()
  if (attemptErr) {
    if (attemptErr.code === 'PGRST116') return null
    throw attemptErr
  }

  const { data: answers, error: answersErr } = await supabase
    .from('exam_attempt_answers')
    .select('*')
    .eq('attempt_id', attemptId)
  if (answersErr) throw answersErr

  return { ...attempt, answers: answers ?? [] }
}

export async function upsertAnswer(
  attemptId: string,
  questionId: string,
  answerText: string | null,
  hintsUsed: number,
) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('exam_attempt_answers')
    .upsert(
      { attempt_id: attemptId, question_id: questionId, answer_text: answerText, hints_used: hintsUsed },
      { onConflict: 'attempt_id,question_id' },
    )
  if (error) throw error
}

export async function markAnswer(
  attemptId: string,
  questionId: string,
  score: number,
  feedback: string,
) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('exam_attempt_answers')
    .update({ score, feedback, marked_at: new Date().toISOString() })
    .eq('attempt_id', attemptId)
    .eq('question_id', questionId)
  if (error) throw error
}

export async function submitAttempt(attemptId: string, totalScore: number, maxScore: number) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('exam_attempts')
    .update({ submitted_at: new Date().toISOString(), total_score: totalScore, max_score: maxScore })
    .eq('id', attemptId)
  if (error) throw error
}

export async function getLatestAttemptForFormat(userId: string, formatId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('exam_format_id', formatId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// ─── Topic Readiness ──────────────────────────────────────────────────────────

export async function getTopicReadinessForCourse(userId: string, courseId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exam_attempt_answers')
    .select(`
      score,
      exam_questions!inner ( topic_id, course_id, max_marks, topics ( name ) ),
      exam_attempts!inner ( user_id )
    `)
    .eq('exam_attempts.user_id', userId)
    .eq('exam_questions.course_id', courseId)
    .not('marked_at', 'is', null)
    .not('exam_questions.topic_id', 'is', null)
  if (error) throw error
  if (!data?.length) return []

  const topicMap = new Map<string, { topic_id: string; topic_name: string; attempted: number; correct: number }>()
  for (const row of data as any[]) {
    const tid = row.exam_questions?.topic_id
    const tname = row.exam_questions?.topics?.name ?? 'Unknown'
    const maxMarks = row.exam_questions?.max_marks ?? 1
    if (!tid) continue
    if (!topicMap.has(tid)) {
      topicMap.set(tid, { topic_id: tid, topic_name: tname, attempted: 0, correct: 0 })
    }
    const entry = topicMap.get(tid)!
    entry.attempted++
    if ((row.score ?? 0) >= maxMarks * 0.5) entry.correct++
  }

  return Array.from(topicMap.values()).map((t) => ({
    topic_id: t.topic_id,
    topic_name: t.topic_name,
    questions_attempted: t.attempted,
    questions_correct: t.correct,
    readiness_score: t.attempted > 0 ? Math.round((t.correct / t.attempted) * 100) : 0,
  }))
}

// ─── Scoring rubric ───────────────────────────────────────────────────────────

export async function getUserScoringRubric(userId: string): Promise<string> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('scoring_rubric')
    .eq('id', userId)
    .single()
  if (error) return ''
  return (data as any)?.scoring_rubric ?? ''
}

export async function setUserScoringRubric(userId: string, rubric: string) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('profiles')
    .update({ scoring_rubric: rubric || null } as any)
    .eq('id', userId)
  if (error) throw error
}
