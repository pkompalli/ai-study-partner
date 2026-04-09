import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listExamDates, upsertExamDate } from '@/lib/db/examDates'

// GET /api/exam-dates — list all exam dates for authenticated user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dates = await listExamDates(user.id)
    return NextResponse.json({ dates })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/exam-dates — create or update an exam date
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      id?: string
      courseId: string
      label: string
      examDate: string
      notes?: string
      chapterIds?: string[]
    }

    if (!body.courseId || !body.label || !body.examDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const date = await upsertExamDate({
      id: body.id,
      userId: user.id,
      courseId: body.courseId,
      label: body.label,
      examDate: body.examDate,
      notes: body.notes,
      chapterIds: body.chapterIds,
    })
    return NextResponse.json({ date })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
