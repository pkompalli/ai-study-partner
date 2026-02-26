import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCoursesByUser,
  createCourse,
} from '@/lib/db/courses'

// GET /api/courses — list all courses for the authenticated user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courses = await getCoursesByUser(user.id)
    return NextResponse.json(courses)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/courses — create a new course record
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      name: string
      description?: string
      goal: 'exam_prep' | 'classwork'
      examName?: string
      yearOfStudy?: string
      sourceType?: string
      sourceFileUrl?: string
      rawInput?: string
      structure?: unknown
    }

    const course = await createCourse(user.id, {
      name: body.name,
      description: body.description,
      goal: body.goal,
      exam_name: body.examName,
      year_of_study: body.yearOfStudy,
      source_type: body.sourceType,
      source_file_url: body.sourceFileUrl,
      raw_input: body.rawInput,
      structure: body.structure,
    })

    return NextResponse.json({ id: course.id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
