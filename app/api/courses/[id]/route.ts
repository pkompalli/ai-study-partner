import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCourseById,
  getCourseWithTree,
  updateCourse,
  deleteCourse,
  getTopicProgress,
} from '@/lib/db'
import { getChapterProgress } from '@/lib/db/topicBank'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/courses/[id] — get course with full subject/topic/chapter tree
// GET /api/courses/[id]?view=progress — get progress for topics and chapters
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const view = req.nextUrl.searchParams.get('view')

    if (view === 'progress') {
      const topicProgress = await getTopicProgress(user.id, id)
      const chapterProgress = await getChapterProgress(user.id, id)
      return NextResponse.json({ topicProgress, chapterProgress })
    }

    const course = await getCourseWithTree(id, user.id)
    return NextResponse.json(course)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/courses/[id] — update course metadata
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
      goal: string
      exam_name: string
      year_of_study: string
      is_active: boolean
    }>

    const updated = await updateCourse(id, user.id, body)
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/courses/[id] — replace course structure (subjects/topics/chapters)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { subjects } = await req.json() as {
      subjects: Array<{
        id?: string
        name: string
        topics: Array<{
          id?: string
          name: string
          chapters?: Array<{ id?: string; name: string }>
        }>
      }>
    }

    // Replace the structure — delete existing subjects/topics/chapters and re-insert
    const svc = await createServiceClient()

    // Verify ownership
    const { data: course, error: courseErr } = await svc
      .from('courses')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (courseErr || !course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Delete existing subjects (cascades to topics/chapters via FK)
    await svc.from('subjects').delete().eq('course_id', id)

    // Re-insert subjects → topics → chapters
    for (let sIdx = 0; sIdx < (subjects ?? []).length; sIdx++) {
      const subj = subjects[sIdx]
      const { data: subjRow, error: subjErr } = await svc
        .from('subjects')
        .insert({ course_id: id, name: subj.name, sort_order: sIdx })
        .select()
        .single()
      if (subjErr || !subjRow) continue

      for (let tIdx = 0; tIdx < (subj.topics ?? []).length; tIdx++) {
        const topic = subj.topics[tIdx]
        const { data: topicRow, error: topicErr } = await svc
          .from('topics')
          .insert({ subject_id: subjRow.id, course_id: id, name: topic.name, sort_order: tIdx })
          .select()
          .single()
        if (topicErr || !topicRow) continue

        for (let cIdx = 0; cIdx < (topic.chapters ?? []).length; cIdx++) {
          const chapter = topic.chapters![cIdx]
          await svc
            .from('chapters')
            .insert({ topic_id: topicRow.id, course_id: id, name: chapter.name, sort_order: cIdx })
        }
      }
    }

    const updated = await getCourseWithTree(id, user.id)
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/courses/[id] — delete a course
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await deleteCourse(id, user.id)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
