import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionById } from '@/lib/db/sessions'
import { reviewTopicCard } from '@/lib/db/topicBank'

// PATCH /api/sessions/[id]/card-review — review a flashcard and update spacing metadata
export async function PATCH(
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

    const { cardId, correct } = await req.json() as { cardId?: string; correct?: boolean }
    if (!cardId || correct === undefined) {
      return NextResponse.json({ error: 'cardId and correct required' }, { status: 400 })
    }

    const result = await reviewTopicCard(user.id, cardId, correct)
    if (!result) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
