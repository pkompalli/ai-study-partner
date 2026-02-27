import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSessionById, saveMessage } from '@/lib/db/sessions'
import { fetchVideoLinks } from '@/lib/youtube'

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

// POST /api/sessions/[id]/videos — fetch curated video links for the session topic
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
    const chapterId = session.chapter_id ?? undefined

    const { topicName, chapterName } = await resolveNames(topicId, chapterId)
    const videos = await fetchVideoLinks(topicName, chapterName)
    await saveMessage(id, 'assistant', 'Here are some helpful videos!', 'videos', { videos })

    return NextResponse.json({ videos })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
