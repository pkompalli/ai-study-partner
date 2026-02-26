import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExamFormatsForCourse,
  createExamFormat,
  getExamFormat,
} from '@/lib/db/examBank'

// GET /api/exam/formats?courseId=xxx — list exam formats for a course
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courseId = req.nextUrl.searchParams.get('courseId')
    if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

    const formats = await getExamFormatsForCourse(user.id, courseId)
    return NextResponse.json(formats)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/exam/formats — create a new exam format
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      courseId?: string
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

    const { courseId, name, sections } = body
    if (!courseId || !name || !Array.isArray(sections)) {
      return NextResponse.json({ error: 'courseId, name, and sections required' }, { status: 400 })
    }

    const format = await createExamFormat(user.id, courseId, body as Parameters<typeof createExamFormat>[2])
    const full = await getExamFormat(format.id, user.id)
    return NextResponse.json(full, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
