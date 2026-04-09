import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateStudyPlanItem, deleteStudyPlanItem } from '@/lib/db/studyPlanItems'

// PATCH /api/study-plan/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as {
      scheduledDate?: string
      scheduledTime?: string
      durationMinutes?: number
      status?: string
    }

    const item = await updateStudyPlanItem(id, user.id, body)
    return NextResponse.json({ item })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/study-plan/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await deleteStudyPlanItem(id, user.id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
