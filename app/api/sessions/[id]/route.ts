import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getSessionById,
  getSessionMessages,
  updateSession,
  endSession,
  deleteSession,
  saveMessage,
  upsertTopicProgress,
} from '@/lib/db/sessions'
import {
  upsertChapterProgress,
} from '@/lib/db/topicBank'
import {
  getCourseContext,
} from '@/lib/db/courses'
import { createArtifact } from '@/lib/db/artifacts'
import { compileArtifact } from '@/lib/llm/artifactCompiler'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/sessions/[id] — get session with messages
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
    const messages = await getSessionMessages(id)
    return NextResponse.json({ ...session, messages })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/sessions/[id] — update session or end session
// Body: { status?, title?, metadata? } or { action: 'end' } to end session and compile artifact
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as {
      action?: string
      title?: string
      status?: string
      metadata?: unknown
    }

    if (body.action === 'end') {
      // End session and compile artifact
      const session = await getSessionById(id, user.id)
      const messages = await getSessionMessages(id)

      const courseCtx = await getCourseContext(session.course_id)
      const courseName = courseCtx?.name ?? 'Course'

      // Get topic and chapter names from DB
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
        await upsertChapterProgress(user.id, session.chapter_id, session.topic_id, session.course_id, 'completed')
      }

      return NextResponse.json({ artifactId: artifact.id })
    }

    // Regular update
    const updated = await updateSession(id, user.id, {
      title: body.title,
      status: body.status,
      metadata: body.metadata,
    })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/sessions/[id] — delete a session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await deleteSession(id, user.id)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
