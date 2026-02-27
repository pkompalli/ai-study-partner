import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionById } from '@/lib/db/sessions'
import { getTopicCards } from '@/lib/db/topicBank'

// GET /api/sessions/[id]/topic-cards — fetch all topic bank cards for the session's topic
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
    const topicId = session.topic_id ?? undefined
    const chapterId = session.chapter_id ?? undefined

    if (!topicId) {
      return NextResponse.json({ cards: [] })
    }

    const cards = await getTopicCards(user.id, topicId, chapterId)
    return NextResponse.json({ cards })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
