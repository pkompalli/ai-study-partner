import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQuiz, submitQuizAnswers } from '@/lib/db/sessions'
import { scoreQuiz } from '@/lib/llm/quizGenerator'
import type { QuizQuestion } from '@/types'

// POST /api/quizzes/[id]/submit
// Body: { answers: Record<string, number> }  (questionId → selected option index)
// Response: { score: number; total: number; results: Array<{ id: string; correct: boolean; explanation: string }> }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: quizId } = await params
    const { answers } = await req.json() as { answers: Record<string, number> }

    const quiz = await getQuiz(quizId, user.id)
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    const { score, total, results } = scoreQuiz(quiz.questions as QuizQuestion[], answers)
    await submitQuizAnswers(quizId, user.id, answers, score, total)

    return NextResponse.json({ score, total, results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
