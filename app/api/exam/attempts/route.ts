import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAttempt, getExamQuestions } from '@/lib/db/examBank'

// POST /api/exam/attempts — create a new exam attempt and return the attempt + questions
// Body: { formatId: string, mode?: 'practice' | 'exam' }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { formatId?: string; mode?: 'practice' | 'exam' }
    const { formatId, mode = 'practice' } = body

    if (!formatId) return NextResponse.json({ error: 'formatId required' }, { status: 400 })

    const attemptId = await createAttempt(user.id, formatId, mode)
    const questions = await getExamQuestions(formatId)

    return NextResponse.json({ attemptId, questions })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
