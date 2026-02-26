import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSessionById, getSessionMessages } from '@/lib/db/sessions'
import { generateResponsePills } from '@/lib/llm/pillsGenerator'

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

    // Get last AI message
    const messages = await getSessionMessages(id)
    const lastAI = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!lastAI) return NextResponse.json({
      question: '', answerPills: [], correctIndex: -1, explanation: '', followupPills: [],
    })

    // Resolve topic name
    const svc = await createServiceClient()
    let topicName = 'General'
    if (session.topic_id) {
      const { data } = await svc.from('topics').select('name').eq('id', session.topic_id).single()
      if (data) topicName = data.name
    }

    const result = await generateResponsePills(
      typeof lastAI.content === 'string' ? lastAI.content : '',
      topicName,
      'intermediate',
    )

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
