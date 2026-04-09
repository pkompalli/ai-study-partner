import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listStudyPlanItems, upsertStudyPlanItems } from '@/lib/db/studyPlanItems'

// GET /api/study-plan?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const date = req.nextUrl.searchParams.get('date') ?? undefined
    const items = await listStudyPlanItems(user.id, date)
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/study-plan — batch upsert
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      items: Array<{
        courseId: string
        subjectId: string
        topicId: string
        scheduledDate: string
        scheduledTime: string
        durationMinutes: number
        source?: 'auto' | 'user'
      }>
    }

    if (!body.items?.length) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    const items = await upsertStudyPlanItems(user.id, body.items)
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
