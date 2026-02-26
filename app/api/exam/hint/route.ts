import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExamQuestionById } from '@/lib/db/examBank'
import { getHint } from '@/lib/llm/examMarker'

// POST /api/exam/hint — get a hint for a question (no attempt context)
// Body: { questionId: string, answerText?: string, hintsUsed?: number }
// Response: { hint: string }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      questionId?: string
      answerText?: string
      hintsUsed?: number
    }

    const { questionId, answerText, hintsUsed } = body

    if (!questionId) return NextResponse.json({ error: 'questionId required' }, { status: 400 })

    const question = await getExamQuestionById(questionId)
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

    const hint = await getHint({
      questionText: question.question_text,
      questionType: question.section_question_type,
      dataset: question.dataset,
      studentAnswer: answerText,
      hintsUsed: hintsUsed ?? 0,
    })

    return NextResponse.json({ hint })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
