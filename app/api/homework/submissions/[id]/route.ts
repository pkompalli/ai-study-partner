import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getHomeworkSubmission } from '@/lib/db/homeworkSubmissions'

// GET /api/homework/submissions/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const submission = await getHomeworkSubmission(id, user.id)
    if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(submission)
  } catch (err: unknown) {
    console.error('[homework-submission-detail] ERROR:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
