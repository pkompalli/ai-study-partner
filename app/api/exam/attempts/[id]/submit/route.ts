import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAttempt,
  getExamQuestions,
  markAnswer as markAnswerDb,
  submitAttempt,
} from '@/lib/db/examBank'
import { markAnswer } from '@/lib/llm/examMarker'

// POST /api/exam/attempts/[id]/submit — submit a completed exam attempt
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const attempt = await getAttempt(id, user.id)
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

    // For exam mode: mark all unmarked answers
    const questions = await getExamQuestions(attempt.exam_format_id)
    const markingJobs = attempt.answers
      .filter((a: { score?: number | null }) => a.score === undefined || a.score === null)
      .map(async (a: { question_id: string; answer_text?: string | null }) => {
        const q = questions.find((q) => q.id === a.question_id)
        if (!q) return
        const result = await markAnswer({
          questionText: q.question_text,
          questionType: q.section_question_type,
          dataset: q.dataset,
          markScheme: q.mark_scheme,
          maxMarks: q.max_marks,
          studentAnswer: a.answer_text ?? '',
          correctOptionIndex: q.correct_option_index,
        })
        await markAnswerDb(id, a.question_id, result.score, result.feedback)
      })

    await Promise.allSettled(markingJobs)

    // Compute total score from fresh data
    const updatedAttempt = await getAttempt(id, user.id)
    if (!updatedAttempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

    const totalScore = updatedAttempt.answers.reduce(
      (sum: number, a: { score?: number | null }) => sum + (a.score ?? 0),
      0,
    )
    const maxScore = questions.reduce((sum, q) => sum + q.max_marks, 0)

    await submitAttempt(id, totalScore, maxScore)

    return NextResponse.json({ totalScore, maxScore })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
