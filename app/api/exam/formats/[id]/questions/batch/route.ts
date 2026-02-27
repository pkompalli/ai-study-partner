import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getExamFormat, saveExamQuestions } from '@/lib/db/examBank'
import { getCourseWithTree, getCourseContext } from '@/lib/db/courses'
import { generateExamQuestions } from '@/lib/llm/examQuestionGenerator'

// POST /api/exam/formats/[id]/questions/batch
// Body: { count?: number; difficulty?: number; topicId?: string; chapterId?: string }
// Generates AI questions for the given topic/chapter scope and returns them immediately.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: formatId } = await params
    const { count = 5, difficulty = 3, topicId, chapterId } = await req.json() as {
      count?: number; difficulty?: number; topicId?: string; chapterId?: string
    }

    const format = await getExamFormat(formatId, user.id)
    if (!format) return NextResponse.json({ error: 'Format not found' }, { status: 404 })

    const courseTree = await getCourseWithTree(format.course_id, user.id)
    const courseCtx = await getCourseContext(format.course_id).catch(() => null)

    // Flatten all topics from the course tree
    const allTopics: Array<{ id: string; name: string; subjectName?: string }> = []
    for (const subject of (courseTree?.subjects ?? []) as Array<{ name: string; topics: Array<{ id: string; name: string }> }>) {
      for (const topic of subject.topics ?? []) {
        allTopics.push({ id: topic.id, name: topic.name, subjectName: subject.name })
      }
    }

    if (allTopics.length === 0) {
      return NextResponse.json({ error: 'Course has no topics' }, { status: 400 })
    }

    // Resolve which topics to generate questions for
    let topics: Array<{ id: string; name: string; subjectName?: string }>

    if (chapterId) {
      // Look up the chapter name so questions are scoped to chapter-level content
      const svc = await createServiceClient()
      const { data: chapterRow } = await svc.from('chapters').select('name').eq('id', chapterId).single()
      const chapterName = chapterRow?.name

      const parentTopicName = topicId
        ? allTopics.find(t => t.id === topicId)?.name
        : undefined

      if (chapterName) {
        // Use chapterId as the topic "id" so we can remap after generation
        topics = [{ id: chapterId, name: chapterName, subjectName: parentTopicName }]
      } else {
        const matched = topicId ? allTopics.filter(t => t.id === topicId) : []
        topics = matched.length > 0 ? matched : allTopics
      }
    } else {
      const matched = topicId ? allTopics.filter(t => t.id === topicId) : []
      topics = matched.length > 0 ? matched : allTopics
    }

    const generated = await generateExamQuestions({
      sections: format.sections,
      topics,
      courseName: courseCtx?.name ?? 'Course',
      examName: format.name,
      yearOfStudy: courseCtx?.yearOfStudy,
      batchCount: Math.min(count, 20),
      difficulty: Math.max(1, Math.min(5, difficulty)),
    })

    if (generated.length === 0) {
      return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
    }

    // Pre-generate UUIDs so we control IDs in both DB row and response
    const questionsWithIds = generated.map(q => ({ ...q, _id: randomUUID() }))

    // Remap topic_id: if we passed chapterId as the LLM "topic id", map it back to
    // the real topicId so the exam_questions.topic_id FK (→ topics) is satisfied
    const resolveTopicId = (qTopicId: string | undefined): string | undefined =>
      chapterId && qTopicId === chapterId ? topicId : qTopicId

    // Save to DB — await so the IDs are persisted before the client calls /answer
    // Destructure _id out so it isn't spread into the insert payload as an unknown column
    await saveExamQuestions(
      formatId,
      user.id,
      format.course_id,
      questionsWithIds.map(({ _id, ...q }) => ({
        ...q,
        id: _id,
        topic_id: resolveTopicId(q.topic_id),
      })),
    )

    // Build the full ExamQuestion response objects
    const sectionMap = Object.fromEntries(format.sections.map(s => [s.id, s]))
    const topicNameMap = Object.fromEntries(topics.map(t => [t.id, t.name]))

    const questions = questionsWithIds.map(q => {
      const section = sectionMap[q.section_id]
      const resolvedTopicId = resolveTopicId(q.topic_id)
      return {
        id: q._id,
        exam_format_id: formatId,
        section_id: q.section_id,
        section_name: section?.name ?? '',
        section_question_type: section?.question_type ?? '',
        topic_id: resolvedTopicId,
        topic_name: resolvedTopicId ? topicNameMap[resolvedTopicId] : undefined,
        course_id: format.course_id,
        question_text: q.question_text,
        dataset: q.dataset,
        options: q.options,
        correct_option_index: q.correct_option_index,
        max_marks: q.max_marks,
        mark_scheme: q.mark_scheme,
        depth: 3,
      }
    })

    return NextResponse.json({ count: questions.length, questions })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
