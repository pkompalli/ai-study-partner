import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTopicReadinessForCourse } from '@/lib/db/examBank'

// GET /api/exam/readiness/[courseId] — get topic readiness scores for a course (dynamic route)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { courseId } = await params
    if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

    const readiness = await getTopicReadinessForCourse(user.id, courseId)
    return NextResponse.json(readiness)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
