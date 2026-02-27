import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExamFormat,
  saveExamQuestions,
  deleteExamQuestions,
  getExamQuestions,
} from '@/lib/db/examBank'
import { getCourseContext, getCourseWithTree } from '@/lib/db/courses'
import { generateExamQuestions } from '@/lib/llm/examQuestionGenerator'
import { randomUUID } from 'crypto'
import { apiErrorResponse, getRequestId, logApiError } from '@/lib/server/apiError'
// GET /api/exam/formats/[id]/questions — list questions for a format
// Optional query param: sectionId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const sectionId = req.nextUrl.searchParams.get('sectionId') ?? undefined

    const format = await getExamFormat(id, user.id)
    if (!format) return NextResponse.json({ error: 'Format not found' }, { status: 404 })

    const questions = await getExamQuestions(id, sectionId)
    return NextResponse.json(questions)
  } catch (err: unknown) {
    logApiError({ route: 'exam/formats/[id]/questions.GET', requestId, req, err })
    const message = err instanceof Error ? err.message : 'Internal error'
    return apiErrorResponse(message, 500, requestId)
  }
}

// POST /api/exam/formats/[id]/questions — generate questions for the format
// Body (optional): { count?, difficulty?, topicId?, chapterId? } for batch mode
// Body empty/omitted: full generation mode (generates num_questions per section)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    let body: {
      count?: number
      difficulty?: number
      topicId?: string
      chapterId?: string
      batch?: boolean
    } = {}
    try {
      body = await req.json()
    } catch { /* no body — full generation mode */ }

    const format = await getExamFormat(id, user.id)
    if (!format) return NextResponse.json({ error: 'Format not found' }, { status: 404 })

    const ctx = await getCourseContext(format.course_id)
    const courseTree = await getCourseWithTree(format.course_id, user.id)

    // Flatten topics
    const allTopics: Array<{ id: string; name: string; subjectName?: string }> = []
    for (const subject of ((courseTree as unknown as { subjects?: Array<{ name: string; topics: Array<{ id: string; name: string }> }> }).subjects ?? [])) {
      for (const topic of subject.topics ?? []) {
        allTopics.push({ id: topic.id, name: topic.name, subjectName: subject.name })
      }
    }

    if (allTopics.length === 0) {
      return NextResponse.json({ error: 'Course has no topics' }, { status: 400 })
    }

    // Batch mode: generate a fixed count distributed across sections
    if (body.count !== undefined || body.batch) {
      const { count = 5, difficulty = 3, topicId, chapterId } = body

      let topics: Array<{ id: string; name: string; subjectName?: string }>
      if (chapterId) {
        const svc = await (await import('@/lib/supabase/server')).createServiceClient()
        const { data: chapter } = await svc.from('chapters').select('name').eq('id', chapterId).single()
        const chapterName = chapter?.name
        const parentTopicName = topicId ? allTopics.find((t) => t.id === topicId)?.name : undefined
        if (chapterName) {
          topics = [{ id: chapterId, name: chapterName, subjectName: parentTopicName }]
        } else {
          const matched = topicId ? allTopics.filter((t) => t.id === topicId) : []
          topics = matched.length > 0 ? matched : allTopics
        }
      } else {
        const matched = topicId ? allTopics.filter((t) => t.id === topicId) : []
        topics = matched.length > 0 ? matched : allTopics
      }

      const resolveTopicId = (qTopicId: string | undefined): string | undefined =>
        body.chapterId && qTopicId === body.chapterId ? body.topicId : qTopicId

      const generated = await generateExamQuestions({
        sections: format.sections,
        topics,
        courseName: ctx?.name ?? 'Course',
        examName: format.name,
        yearOfStudy: ctx?.yearOfStudy,
        batchCount: Math.min(count, 20),
        difficulty: Math.max(1, Math.min(5, difficulty)),
      })

      if (generated.length === 0) {
        return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
      }

      const sectionMap = Object.fromEntries(format.sections.map((s) => [s.id, s]))
      const topicNameMap = Object.fromEntries(topics.map((t) => [t.id, t.name]))
      const questionsWithIds = generated.map((q) => ({ ...q, _id: randomUUID() }))

      await saveExamQuestions(id, user.id, format.course_id, questionsWithIds.map((q) => ({
        ...q,
        id: q._id,
        topic_id: resolveTopicId(q.topic_id),
      })))

      const questions = questionsWithIds.map((q) => {
        const section = sectionMap[q.section_id]
        const resolvedTopicId = resolveTopicId(q.topic_id)
        return {
          id: q._id,
          exam_format_id: id,
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
    }

    // Full generation mode
    await deleteExamQuestions(id)

    const generated = await generateExamQuestions({
      sections: format.sections,
      topics: allTopics,
      courseName: ctx?.name ?? 'Course',
      examName: format.name,
      yearOfStudy: ctx?.yearOfStudy,
    })

    if (generated.length === 0) {
      return NextResponse.json({ error: 'Failed to generate any questions' }, { status: 500 })
    }

    await saveExamQuestions(id, user.id, format.course_id, generated)
    const questions = await getExamQuestions(id)
    return NextResponse.json({ count: questions.length, questions })
  } catch (err: unknown) {
    logApiError({ route: 'exam/formats/[id]/questions.POST', requestId, req, err })
    const message = err instanceof Error ? err.message : 'Internal error'
    const lower = message.toLowerCase()
    const providerAuthError =
      lower.includes('security token') ||
      lower.includes('unrecognizedclientexception') ||
      lower.includes('access key') ||
      lower.includes('credentials') ||
      lower.includes('invalid api key') ||
      lower.includes('unauthorized') ||
      lower.includes('subscription key')

    if (providerAuthError) {
      return apiErrorResponse(
        'Question generation provider authentication failed. Check LLM credentials in .env.local (Azure/OpenAI/Google/AWS).',
        502,
        requestId,
      )
    }

    return apiErrorResponse(message, 500, requestId)
  }
}

// DELETE /api/exam/formats/[id]/questions — clear all questions for a format
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const format = await getExamFormat(id, user.id)
    if (!format) return NextResponse.json({ error: 'Format not found' }, { status: 404 })

    await deleteExamQuestions(id)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    logApiError({ route: 'exam/formats/[id]/questions.DELETE', requestId, req, err })
    const message = err instanceof Error ? err.message : 'Internal error'
    return apiErrorResponse(message, 500, requestId)
  }
}
