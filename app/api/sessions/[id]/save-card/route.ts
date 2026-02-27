import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSessionById } from '@/lib/db/sessions'

// POST /api/sessions/[id]/save-card — save a single user-created flashcard from a Q&A interaction
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const session = await getSessionById(id, user.id)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { topic_id, chapter_id, course_id } = session
    if (!topic_id) return NextResponse.json({ error: 'Session has no topic' }, { status: 400 })

    const { question, answer, explanation } = await req.json() as {
      question: string; answer: string; explanation?: string
    }

    // Combine answer and explanation into the back of the card (same as Express server)
    const back = explanation ? `${answer}\n\n${explanation}` : answer

    const svc = await createServiceClient()
    const { data, error } = await svc
      .from('topic_cards')
      .insert({
        user_id: user.id,
        topic_id,
        course_id,
        session_id: id,
        chapter_id: chapter_id ?? null,
        front: question,
        back,
        depth: 3,
      })
      .select('id, front, back, mnemonic, depth, ease_factor, interval_days, times_seen, times_correct, next_review_at, last_reviewed_at, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ card: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
