import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getSessionsByUser,
  getSessionsByCourse,
  createSession,
} from '@/lib/db/sessions'

// GET /api/sessions?courseId=xxx — list sessions (optionally filtered by course)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courseId = req.nextUrl.searchParams.get('courseId')

    const sessions = courseId
      ? await getSessionsByCourse(courseId, user.id)
      : await getSessionsByUser(user.id)

    return NextResponse.json(sessions)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/sessions — create a new study session
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { courseId, topicId, chapterId } = await req.json() as {
      courseId: string
      topicId?: string
      chapterId?: string
    }

    const session = await createSession(user.id, {
      course_id: courseId,
      topic_id: topicId,
      chapter_id: chapterId,
    })

    return NextResponse.json({ id: session.id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
