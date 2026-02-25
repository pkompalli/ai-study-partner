import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAttempt } from '@/lib/db/examBank'

// GET /api/exam/attempts/[id] — get an exam attempt with answers
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const attempt = await getAttempt(id, user.id)
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    return NextResponse.json(attempt)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
