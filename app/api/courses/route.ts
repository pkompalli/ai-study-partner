import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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
      structure?: {
        subjects?: Array<{
          name: string
          topics?: Array<{
            name: string
            chapters?: Array<{ name: string }>
          }>
        }>
      }
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

    // Materialize structure into relational subjects/topics rows
    const subjects = body.structure?.subjects ?? []
    if (subjects.length > 0) {
      const svc = await createServiceClient()
      for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
        const subj = subjects[sIdx]
        const { data: subjRow, error: subjErr } = await svc
          .from('subjects')
          .insert({ course_id: course.id, name: subj.name, sort_order: sIdx })
          .select()
          .single()
        if (subjErr || !subjRow) continue
        for (let tIdx = 0; tIdx < (subj.topics ?? []).length; tIdx++) {
          const topic = subj.topics![tIdx]
          const { data: topicRow, error: topicErr } = await svc
            .from('topics')
            .insert({ subject_id: subjRow.id, course_id: course.id, name: topic.name, sort_order: tIdx })
            .select()
            .single()
          if (topicErr || !topicRow) continue

          for (let cIdx = 0; cIdx < (topic.chapters ?? []).length; cIdx++) {
            const chapter = topic.chapters![cIdx]
            await svc
              .from('chapters')
              .insert({ topic_id: topicRow.id, course_id: course.id, name: chapter.name, sort_order: cIdx })
          }
        }
      }
    }

    return NextResponse.json({ id: course.id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
