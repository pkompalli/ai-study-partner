import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExamFormat,
  createAttempt,
  getExamQuestions,
} from '@/lib/db/examBank'

// POST /api/exam/formats/[id]/attempts — start a new exam attempt
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { mode } = await req.json() as { mode?: 'practice' | 'exam' }

    const format = await getExamFormat(id, user.id)
    if (!format) return NextResponse.json({ error: 'Format not found' }, { status: 404 })

    const attemptId = await createAttempt(user.id, id, mode ?? 'practice')
    const questions = await getExamQuestions(id)

    return NextResponse.json({ attemptId, questions }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
