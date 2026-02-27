import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getSessionById,
  getSessionMessages,
  endSession,
  upsertTopicProgress,
} from '@/lib/db/sessions'
import { upsertChapterProgress } from '@/lib/db/topicBank'
import { getCourseContext } from '@/lib/db/courses'
import { createArtifact } from '@/lib/db/artifacts'
import { compileArtifact } from '@/lib/llm/artifactCompiler'

// PATCH /api/sessions/[id]/end — end the session and compile a lesson artifact
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const session = await getSessionById(id, user.id)
    const messages = await getSessionMessages(id)

    const courseCtx = await getCourseContext(session.course_id)
    const courseName = courseCtx?.name ?? 'Course'

    // Resolve topic and chapter names
    let topicName = 'General'
    let chapterName: string | undefined

    if (session.topic_id) {
      const svc = await createServiceClient()
      const { data: topic } = await svc
        .from('topics')
        .select('name')
        .eq('id', session.topic_id)
        .single()
      if (topic) topicName = topic.name
    }
    if (session.chapter_id) {
      const svc = await createServiceClient()
      const { data: chapter } = await svc
        .from('chapters')
        .select('name')
        .eq('id', session.chapter_id)
        .single()
      if (chapter) chapterName = chapter.name
    }

    const markdownContent = await compileArtifact({
      courseName,
      topicName,
      chapterName,
      messages,
    })

    const title = `${topicName}${chapterName ? ` — ${chapterName}` : ''} — Study Session`
    const artifact = await createArtifact(user.id, {
      session_id: id,
      course_id: session.course_id,
      topic_id: session.topic_id ?? undefined,
      title,
      markdown_content: markdownContent,
    })

    await endSession(id, user.id)

    if (session.topic_id) {
      await upsertTopicProgress(user.id, session.topic_id, session.course_id, 'completed')
    }
    if (session.chapter_id && session.topic_id) {
      await upsertChapterProgress(
        user.id,
        session.chapter_id,
        session.topic_id,
        session.course_id,
        'completed',
      )
    }

    return NextResponse.json({ artifactId: artifact.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
