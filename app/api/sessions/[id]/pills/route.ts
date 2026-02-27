import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLatestAssistantTextMessage, getSessionById } from '@/lib/db/sessions'
import { getCourseContext } from '@/lib/db/courses'
import { generateResponsePills } from '@/lib/llm/pillsGenerator'
import { inferAcademicLevel } from '@/lib/llm/prompts'
import { checkRateLimit } from '@/lib/server/rateLimit'

// GET /api/sessions/[id]/pills — generate response pills for the last AI message
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const session = await getSessionById(id, user.id)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const limit = checkRateLimit(`pills:${user.id}:${id}`, { limit: 30, windowMs: 60_000 })
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many comprehension checks. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const lastAI = await getLatestAssistantTextMessage(id)
    if (!lastAI) {
      return NextResponse.json({
        sourceMessageId: null,
        question: '',
        answerPills: [],
        correctIndex: -1,
        explanation: '',
        followupPills: [],
      })
    }

    // Resolve topic name
    const svc = await createServiceClient()
    let topicName = 'General'
    if (session.topic_id) {
      const { data } = await svc.from('topics').select('name').eq('id', session.topic_id).single()
      if (data) topicName = data.name
    }

    const courseCtx = await getCourseContext(session.course_id)
    const level = inferAcademicLevel(courseCtx?.yearOfStudy, courseCtx?.name)

    const result = await generateResponsePills(
      typeof lastAI.content === 'string' ? lastAI.content : '',
      topicName,
      level.label,
    )

    return NextResponse.json({ sourceMessageId: lastAI.id ?? null, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
