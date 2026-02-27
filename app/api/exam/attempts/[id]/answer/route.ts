import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAttempt,
  getExamQuestions,
  upsertAnswer,
  markAnswer as markAnswerDb,
} from '@/lib/db/examBank'
import { markAnswer } from '@/lib/llm/examMarker'

// POST /api/exam/attempts/[id]/answer — submit and mark a single answer within an attempt
// Body: { questionId: string, answerText?: string, selectedOptionIndex?: number, hintsUsed?: number }
// Response: { score?: number, maxMarks?: number, feedback?: string, saved?: boolean }
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
      selectedOptionIndex?: number
      hintsUsed?: number
    }

    const { questionId, answerText, selectedOptionIndex, hintsUsed } = body

    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 })

    const attempt = await getAttempt(id, user.id)
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

    const questions = await getExamQuestions(attempt.exam_format_id)
    const question = questions.find((q) => q.id === questionId)
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

    await upsertAnswer(id, questionId, answerText ?? null, hintsUsed ?? 0)

    const isMcq = question.section_question_type === 'mcq'
    const isPractice = attempt.mode === 'practice'

    if (isPractice || isMcq) {
      const result = await markAnswer({
        questionText: question.question_text,
        questionType: question.section_question_type,
        dataset: question.dataset,
        markScheme: question.mark_scheme,
        maxMarks: question.max_marks,
        studentAnswer: isMcq
          ? (question.options?.[selectedOptionIndex ?? -1] ?? answerText ?? '')
          : (answerText ?? ''),
        correctOptionIndex: question.correct_option_index,
        selectedOptionIndex,
      })

      await markAnswerDb(id, questionId, result.score, result.feedback)
      return NextResponse.json({ score: result.score, maxMarks: question.max_marks, feedback: result.feedback })
    }

    return NextResponse.json({ saved: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
