import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSessionById, getSessionMessages, saveMessage, saveQuiz } from '@/lib/db/sessions'
import { generateQuiz } from '@/lib/llm/quizGenerator'

// Helper to resolve topic name from topic_id
async function resolveTopicName(topicId?: string | null): Promise<string> {
  if (!topicId) return 'General'
  const svc = await createServiceClient()
  const { data } = await svc.from('topics').select('name').eq('id', topicId).single()
  return data?.name ?? 'General'
}

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

    const messages = await getSessionMessages(id)
    const topicName = await resolveTopicName(topicId)

    const questions = await generateQuiz(topicName, messages)
    const quizId = await saveQuiz(id, user.id, topicId, questions)
    await saveMessage(id, 'assistant', 'Here is your quiz!', 'quiz', { quizId, questions })

    return NextResponse.json({ id: quizId, questions })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
