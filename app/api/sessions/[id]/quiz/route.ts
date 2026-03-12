import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSessionById, getSessionMessages, saveMessage, saveQuiz } from '@/lib/db/sessions'
import { generateQuiz } from '@/lib/llm/quizGenerator'

// POST /api/sessions/[id]/quiz — generate a quiz from the session conversation
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const session = await getSessionById(id, user.id)
    const topicId = session.topic_id ?? undefined

    // Resolve topic/chapter names and messages in parallel
    const svc = await createServiceClient()
    const [messages, topicResult, chapterResult] = await Promise.all([
      getSessionMessages(id),
      session.topic_id
        ? svc.from('topics').select('name').eq('id', session.topic_id).single()
        : Promise.resolve({ data: null }),
      session.chapter_id
        ? svc.from('chapters').select('name').eq('id', session.chapter_id).single()
        : Promise.resolve({ data: null }),
    ])
    const topicName = topicResult.data?.name ?? 'General'
    const chapterName: string | undefined = chapterResult.data?.name ?? undefined

    const questions = await generateQuiz(topicName, messages, chapterName)
    const quizId = await saveQuiz(id, user.id, topicId, questions)
    await saveMessage(id, 'assistant', 'Here is your quiz!', 'quiz', { quizId, questions })

    return NextResponse.json({ id: quizId, questions })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
