import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listHomeworkSubmissions } from '@/lib/db/homeworkSubmissions'

// GET /api/homework/submissions?courseId=...&topicId=...&chapterId=...
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get('courseId')
    if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

    const topicId = searchParams.get('topicId') ?? undefined
    const chapterId = searchParams.get('chapterId') ?? undefined

    const submissions = await listHomeworkSubmissions({
      userId: user.id,
      courseId,
      topicId,
      chapterId,
    })

    return NextResponse.json({ submissions })
  } catch (err: unknown) {
    console.error('[homework-submissions] ERROR:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
