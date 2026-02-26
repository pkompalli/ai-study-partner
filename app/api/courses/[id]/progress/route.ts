import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTopicProgress } from '@/lib/db/sessions'
import { getChapterProgress } from '@/lib/db/topicBank'

// GET /api/courses/[id]/progress — get topic and chapter progress for a course
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const topicProgress = await getTopicProgress(user.id, id)
    const chapterProgress = await getChapterProgress(user.id, id)

    return NextResponse.json({ topicProgress, chapterProgress })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
