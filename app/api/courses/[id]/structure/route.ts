import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCourseWithTree } from '@/lib/db'

// PUT /api/courses/[id]/structure — replace course structure (subjects → topics)
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
