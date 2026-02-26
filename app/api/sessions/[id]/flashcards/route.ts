import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getSessionById,
  getSessionMessages,
  saveMessage,
  saveFlashcardSet,
} from '@/lib/db/sessions'
import {
  getTopicCards,
  getTopicCardFronts,
  saveTopicCards,
} from '@/lib/db/topicBank'
import { generateFlashcards } from '@/lib/llm/flashcardGenerator'

// Helper to resolve topic and chapter names from IDs
async function resolveNames(
  topicId?: string | null,
  chapterId?: string | null,
): Promise<{ topicName: string; chapterName?: string }> {
  const svc = await createServiceClient()
  let topicName = 'General'
  let chapterName: string | undefined

  if (topicId) {
    const { data } = await svc.from('topics').select('name').eq('id', topicId).single()
    if (data) topicName = data.name
  }
  if (chapterId) {
    const { data } = await svc.from('chapters').select('name').eq('id', chapterId).single()
    if (data) chapterName = data.name
  }

  return { topicName, chapterName }
}

// POST /api/sessions/[id]/flashcards — generate flashcards from the session conversation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // depth is optional in the request body
    let depth = 0
    try {
      const body = await req.json() as { depth?: number }
      if (typeof body.depth === 'number') depth = body.depth
    } catch { /* body is optional */ }

    const session = await getSessionById(id, user.id)
    const topicId = session.topic_id ?? undefined
    const chapterId = session.chapter_id ?? undefined

    const messages = await getSessionMessages(id)
    const { topicName, chapterName } = await resolveNames(topicId, chapterId)
    const flashcardContext = chapterName ? `${topicName} — ${chapterName}` : topicName
    const existingFronts = topicId ? await getTopicCardFronts(user.id, topicId, chapterId) : []

    const newCards = await generateFlashcards(flashcardContext, messages, existingFronts)

    if (topicId && newCards.length > 0) {
      await saveTopicCards(user.id, topicId, session.course_id, id, depth, newCards, chapterId)
    }

    const setId = await saveFlashcardSet(id, user.id, topicId, newCards)
    await saveMessage(id, 'assistant', 'Here are your flashcards!', 'flashcards', { setId, cards: newCards })

    // Return all cards for this topic so the deck is complete
    const allCards = topicId ? await getTopicCards(user.id, topicId, chapterId) : newCards
    return NextResponse.json({ id: setId, cards: allCards })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
