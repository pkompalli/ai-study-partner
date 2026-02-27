import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExamFormat,
  updateExamFormat,
  replaceSections,
  deleteExamFormat,
} from '@/lib/db/examBank'

// GET /api/exam/formats/[id] — get a single exam format
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const format = await getExamFormat(id, user.id)
    if (!format) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(format)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/exam/formats/[id] — update exam format metadata
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as Partial<{
      name: string
      description: string
      total_marks: number
      time_minutes: number
      instructions: string
    }>

    await updateExamFormat(id, user.id, body)
    const format = await getExamFormat(id, user.id)
    return NextResponse.json(format)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/exam/formats/[id] — replace exam format (metadata + sections)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { sections, ...meta } = await req.json() as {
      name?: string
      description?: string
      total_marks?: number
      time_minutes?: number
      instructions?: string
      sections?: Array<{
        name: string
        question_type: string
        num_questions: number
        marks_per_question?: number
        total_marks?: number
        instructions?: string
      }>
    }

    await updateExamFormat(id, user.id, meta)
    if (sections && sections.length > 0) {
      await replaceSections(id, user.id, sections)
    }

    const format = await getExamFormat(id, user.id)
    if (!format) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(format)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/exam/formats/[id] — delete an exam format
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await deleteExamFormat(id, user.id)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
