import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCourseContext } from '@/lib/db/courses'
import { generateHomeworkProblems } from '@/lib/llm/homeworkGenerator'
import { generateChapterKeyPoints } from '@/lib/llm/examQuestionGenerator'
import { checkRateLimit } from '@/lib/server/rateLimit'

export const runtime = 'nodejs'

// POST /api/homework/problems — generate practice homework problems
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = checkRateLimit(`homework-problems:${user.id}`, { limit: 20, windowMs: 60_000 })
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const body = await req.json() as {
      courseId: string
      count?: number
      difficulty?: number
      subjectId?: string
      topicId?: string
      chapterId?: string
    }

    if (!body.courseId) {
      return NextResponse.json({ error: 'courseId required' }, { status: 400 })
    }

    const ctx = await getCourseContext(body.courseId)
    const courseName = ctx?.name ?? 'Course'

    // Resolve topics to generate problems for
    const service = await createServiceClient()
    let topics: Array<{ id: string; name: string; subjectName?: string; chapterName?: string; priorChapters?: string[]; laterChapters?: string[]; chapterContent?: string }> = []

    if (body.chapterId) {
      // Scoped to chapter
      const { data: chapter } = await service
        .from('chapters')
        .select('id, name, topic_id, topics(name, subject_id, subjects(name))')
        .eq('id', body.chapterId)
        .single()
      if (chapter) {
        const topicData = chapter.topics as unknown as { name: string; subject_id: string; subjects: { name: string } }
        // Get sibling chapters for prior/later context
        const { data: siblings } = await service
          .from('chapters')
          .select('id, name, sort_order')
          .eq('topic_id', chapter.topic_id)
          .order('sort_order')
        const sortedSiblings = siblings ?? []
        const currentIdx = sortedSiblings.findIndex(s => s.id === body.chapterId)
        const priorChapters = sortedSiblings.slice(0, currentIdx).map(s => s.name)
        const laterChapters = sortedSiblings.slice(currentIdx + 1).map(s => s.name)

        // Try to get chapter content
        let chapterContent: string | undefined
        const { data: summaryRow } = await service
          .from('summaries')
          .select('content')
          .eq('chapter_id', body.chapterId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (summaryRow?.content) {
          chapterContent = summaryRow.content
        } else {
          // Generate key points
          chapterContent = await generateChapterKeyPoints({
            chapterName: chapter.name,
            topicName: topicData.name,
            courseName,
            siblingChapters: sortedSiblings.filter(s => s.id !== body.chapterId).map(s => s.name),
          })
        }

        topics = [{
          id: chapter.topic_id,
          name: topicData.name,
          subjectName: topicData.subjects?.name,
          chapterName: chapter.name,
          priorChapters,
          laterChapters,
          chapterContent,
        }]
      }
    } else if (body.topicId) {
      // Scoped to topic
      const { data: topic } = await service
        .from('topics')
        .select('id, name, subject_id, subjects(name)')
        .eq('id', body.topicId)
        .single()
      if (topic) {
        const subjectData = topic.subjects as unknown as { name: string }
        topics = [{ id: topic.id, name: topic.name, subjectName: subjectData?.name }]
      }
    } else {
      // All topics for the course (pick a few)
      const { data: allTopics } = await service
        .from('topics')
        .select('id, name, subject_id, subjects(name)')
        .eq('course_id', body.courseId)
        .limit(10)
      if (allTopics?.length) {
        topics = allTopics.map(t => ({
          id: t.id,
          name: t.name,
          subjectName: (t.subjects as unknown as { name: string })?.name,
        }))
      }
    }

    if (!topics.length) {
      return NextResponse.json({ error: 'No topics found for this course' }, { status: 400 })
    }

    const problems = await generateHomeworkProblems({
      topics,
      courseName,
      count: body.count ?? 5,
      difficulty: body.difficulty ?? 3,
    })

    return NextResponse.json({ problems })
  } catch (err: unknown) {
    console.error('[homework-problems] ERROR:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
