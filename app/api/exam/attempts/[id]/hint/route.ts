import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAttempt, getExamQuestions, upsertAnswer } from '@/lib/db/examBank'
import { getHint } from '@/lib/llm/examMarker'

// POST /api/exam/attempts/[id]/hint — get a hint for a question within an attempt
// Body: { questionId: string, answerText?: string }
// Response: { hint: string, hintsUsed: number }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const body = await req.json() as {
      questionId: string
      answerText?: string
    }

    const { questionId, answerText } = body

    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 })

    const attempt = await getAttempt(id, user.id)
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

    const questions = await getExamQuestions(attempt.exam_format_id)
    const question = questions.find((q) => q.id === questionId)
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

    const existingAnswer = attempt.answers.find(
      (a: { question_id: string; hints_used?: number }) => a.question_id === questionId,
    )
    const hintsUsedCount = existingAnswer?.hints_used ?? 0

    const hint = await getHint({
      questionText: question.question_text,
      questionType: question.section_question_type,
      dataset: question.dataset,
      studentAnswer: answerText,
      hintsUsed: hintsUsedCount,
    })

    await upsertAnswer(
      id,
      questionId,
      answerText ?? (existingAnswer as { answer_text?: string | null })?.answer_text ?? null,
      hintsUsedCount + 1,
    )

    return NextResponse.json({ hint, hintsUsed: hintsUsedCount + 1 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
