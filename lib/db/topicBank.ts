import { createServiceClient } from '@/lib/supabase/server'

function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === 'PGRST205' || error.code === '42P01') return true
  return (error.message ?? '').includes("Could not find the table")
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicCard {
  id: string
  front: string
  back: string
  mnemonic?: string
  depth: number
  ease_factor: number
  interval_days: number
  times_seen: number
  times_correct: number
  next_review_at?: string
  last_reviewed_at?: string
  created_at: string
}

export interface TopicCheckQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  depth: number
  created_at: string
}

export interface ReviewResult {
  cardId: string
  intervalDays: number
  easeFactor: number
  timesSeen: number
  timesCorrect: number
  nextReviewAt: string
}

// ─── Topics ───────────────────────────────────────────────────────────────────

export async function getTopicsByCourse(courseId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getTopicsBySubject(subjectId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export async function getTopicCards(userId: string, topicId: string, chapterId?: string): Promise<TopicCard[]> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('topic_cards')
    .select('id, front, back, mnemonic, depth, ease_factor, interval_days, times_seen, times_correct, next_review_at, last_reviewed_at, created_at')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  } else {
    query = query.is('chapter_id', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as TopicCard[]
}

export async function getTopicCardFronts(userId: string, topicId: string, chapterId?: string): Promise<string[]> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('topic_cards')
    .select('front')
    .eq('user_id', userId)
    .eq('topic_id', topicId)

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  } else {
    query = query.is('chapter_id', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r: any) => r.front as string)
}

export async function saveTopicCards(
  userId: string,
  topicId: string,
  courseId: string,
  sessionId: string,
  depth: number,
  cards: Array<{ front: string; back: string; mnemonic?: string | null }>,
  chapterId?: string,
) {
  const supabase = await createServiceClient()
  const rows = cards.map((c) => ({
    user_id: userId,
    topic_id: topicId,
    course_id: courseId,
    session_id: sessionId,
    chapter_id: chapterId ?? null,
    front: c.front,
    back: c.back,
    mnemonic: c.mnemonic ?? null,
    depth,
  }))
  // upsert with ignoreDuplicates to match INSERT OR IGNORE behavior
  const { error } = await supabase
    .from('topic_cards')
    .upsert(rows, { ignoreDuplicates: true })
  if (error) throw error
}

export async function reviewTopicCard(
  userId: string,
  cardId: string,
  correct: boolean,
): Promise<ReviewResult | null> {
  const supabase = await createServiceClient()

  const { data: row, error: fetchErr } = await supabase
    .from('topic_cards')
    .select('ease_factor, interval_days, times_seen, times_correct')
    .eq('id', cardId)
    .eq('user_id', userId)
    .single()
  if (fetchErr || !row) return null

  let ease = (row as any).ease_factor ?? 2.5
  let interval = (row as any).interval_days ?? 1
  let timesSeen = ((row as any).times_seen ?? 0) + 1
  let timesCorrect = (row as any).times_correct ?? 0

  if (correct) {
    timesCorrect++
    if (timesCorrect === 1) interval = 1
    else if (timesCorrect === 2) interval = 3
    else interval = Math.round(interval * ease)
    ease = Math.min(3.0, ease + 0.1)
  } else {
    interval = 1
    ease = Math.max(1.3, ease - 0.2)
  }

  const nextReviewAt = new Date(Date.now() + interval * 86_400_000).toISOString()
  const now = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from('topic_cards')
    .update({ ease_factor: ease, interval_days: interval, times_seen: timesSeen, times_correct: timesCorrect, next_review_at: nextReviewAt, last_reviewed_at: now })
    .eq('id', cardId)
    .eq('user_id', userId)
  if (updateErr) throw updateErr

  return { cardId, intervalDays: interval, easeFactor: ease, timesSeen, timesCorrect, nextReviewAt }
}

// ─── Cross-topic surfacing ────────────────────────────────────────────────────

export async function getCrossTopicCards(
  userId: string,
  courseId: string,
  currentTopicId: string,
  currentTopicName: string,
  limit = 3,
) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('topic_cards')
    .select(`
      id, front, back, mnemonic, topic_id,
      topics ( name )
    `)
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .neq('topic_id', currentTopicId)
    .order('times_correct', { ascending: false })
  if (error) throw error
  if (!data?.length) return []

  const keywords = currentTopicName
    .toLowerCase()
    .split(/[\s\-_,/()]+/)
    .filter((w) => w.length > 3)

  if (keywords.length === 0) return []

  return (data as any[])
    .map((card) => {
      const text = `${card.front} ${card.back}`.toLowerCase()
      const score = keywords.filter((kw: string) => text.includes(kw)).length
      return {
        id: card.id,
        front: card.front,
        back: card.back,
        mnemonic: card.mnemonic ?? undefined,
        source_topic_id: card.topic_id,
        source_topic_name: card.topics?.name ?? 'Unknown',
        score,
      }
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ─── Check questions ──────────────────────────────────────────────────────────

export async function getTopicCheckQuestions(
  userId: string,
  topicId: string,
  chapterId?: string,
): Promise<TopicCheckQuestion[]> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('topic_check_questions')
    .select('id, question, options, correct_index, explanation, depth, created_at')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  } else {
    query = query.is('chapter_id', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    question: r.question,
    options: Array.isArray(r.options) ? r.options : (typeof r.options === 'string' ? JSON.parse(r.options) : r.options),
    correctIndex: r.correct_index,
    explanation: r.explanation,
    depth: r.depth,
    created_at: r.created_at,
  }))
}

export async function saveTopicCheckQuestions(
  userId: string,
  topicId: string,
  courseId: string,
  sessionId: string,
  depth: number,
  questions: Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>,
  chapterId?: string,
) {
  const supabase = await createServiceClient()
  const rows = questions.map((q) => ({
    user_id: userId,
    topic_id: topicId,
    course_id: courseId,
    session_id: sessionId,
    chapter_id: chapterId ?? null,
    question: q.question,
    options: q.options,
    correct_index: q.correctIndex,
    explanation: q.explanation,
    depth,
  }))
  const { error } = await supabase
    .from('topic_check_questions')
    .upsert(rows, { ignoreDuplicates: true })
  if (error) throw error
}

// ─── Topic summary cache ──────────────────────────────────────────────────────

export interface CachedSummary {
  depth: number
  summary: string
  question: string
  answer_pills: string[]
  correct_index: number
  explanation: string
  starters: string[]
}

export async function getCachedSummary(
  userId: string,
  topicId: string,
  depth: number,
): Promise<CachedSummary | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('topic_summaries')
    .select('*')
    .eq('topic_id', topicId)
    .eq('user_id', userId)
    .eq('depth', depth)
    .single()
  if (error) {
    if (error.code === 'PGRST116' || isMissingTableError(error)) return null
    throw error
  }
  if (!data) return null
  return {
    depth: (data as any).depth,
    summary: (data as any).summary,
    question: (data as any).question,
    answer_pills: Array.isArray((data as any).answer_pills)
      ? (data as any).answer_pills
      : JSON.parse((data as any).answer_pills ?? '[]'),
    correct_index: (data as any).correct_index,
    explanation: (data as any).explanation,
    starters: Array.isArray((data as any).starters)
      ? (data as any).starters
      : JSON.parse((data as any).starters ?? '[]'),
  }
}

export async function getLastCachedDepth(userId: string, topicId: string): Promise<number | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('topic_summaries')
    .select('depth')
    .eq('topic_id', topicId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  if (error) return null
  return (data as any)?.depth ?? null
}

export async function saveSummaryCache(
  userId: string,
  topicId: string,
  depth: number,
  data: {
    summary: string
    question: string
    answer_pills: string[]
    correct_index: number
    explanation: string
    starters: string[]
  },
) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('topic_summaries')
    .upsert(
      {
        topic_id: topicId,
        user_id: userId,
        depth,
        summary: data.summary,
        question: data.question,
        answer_pills: data.answer_pills,
        correct_index: data.correct_index,
        explanation: data.explanation,
        starters: data.starters,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'topic_id,user_id,depth' },
    )
  if (error) throw error
}

// ─── Chapter summary cache ────────────────────────────────────────────────────

export async function getCachedChapterSummary(
  userId: string,
  chapterId: string,
  depth: number,
): Promise<CachedSummary | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('chapter_summaries')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('user_id', userId)
    .eq('depth', depth)
    .single()
  if (error) {
    if (error.code === 'PGRST116' || isMissingTableError(error)) return null
    throw error
  }
  if (!data) return null
  return {
    depth: (data as any).depth,
    summary: (data as any).summary,
    question: (data as any).question,
    answer_pills: Array.isArray((data as any).answer_pills)
      ? (data as any).answer_pills
      : JSON.parse((data as any).answer_pills ?? '[]'),
    correct_index: (data as any).correct_index,
    explanation: (data as any).explanation,
    starters: Array.isArray((data as any).starters)
      ? (data as any).starters
      : JSON.parse((data as any).starters ?? '[]'),
  }
}

export async function getLastCachedChapterDepth(userId: string, chapterId: string): Promise<number | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('chapter_summaries')
    .select('depth')
    .eq('chapter_id', chapterId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  if (error) return null
  return (data as any)?.depth ?? null
}

export async function saveChapterSummaryCache(
  userId: string,
  chapterId: string,
  depth: number,
  data: {
    summary: string
    question: string
    answer_pills: string[]
    correct_index: number
    explanation: string
    starters: string[]
  },
) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('chapter_summaries')
    .upsert(
      {
        chapter_id: chapterId,
        user_id: userId,
        depth,
        summary: data.summary,
        question: data.question,
        answer_pills: data.answer_pills,
        correct_index: data.correct_index,
        explanation: data.explanation,
        starters: data.starters,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chapter_id,user_id,depth' },
    )
  if (error && !isMissingTableError(error)) throw error
}

// ─── Chapter progress ─────────────────────────────────────────────────────────

export async function getChapterProgress(userId: string, courseId: string) {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('chapter_progress')
    .select('chapter_id, status, last_studied')
    .eq('user_id', userId)
    .eq('course_id', courseId)
  if (error) throw error
  return Object.fromEntries(
    (data ?? []).map((r: any) => [r.chapter_id, { status: r.status, last_studied: r.last_studied }]),
  )
}

export async function upsertChapterProgress(
  userId: string,
  chapterId: string,
  topicId: string,
  courseId: string,
  status: string,
) {
  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('chapter_progress')
    .upsert(
      { user_id: userId, chapter_id: chapterId, topic_id: topicId, course_id: courseId, status, last_studied: new Date().toISOString() },
      { onConflict: 'user_id,chapter_id' },
    )
  if (error && !isMissingTableError(error)) throw error
}
