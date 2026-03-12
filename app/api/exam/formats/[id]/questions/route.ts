import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExamFormat,
  saveExamQuestions,
  deleteExamQuestions,
  getExamQuestions,
  getExamQuestionsByTopicAndDepth,
} from '@/lib/db/examBank'
import { getCourseContext, getCourseWithTree } from '@/lib/db/courses'
import { getCachedChapterSummary, getLastCachedChapterDepth, getCachedSummary, getLastCachedDepth } from '@/lib/db/topicBank'
import { generateExamQuestions, generateChapterKeyPoints } from '@/lib/llm/examQuestionGenerator'
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
      subjectId?: string
      topicId?: string
      chapterId?: string
      batch?: boolean
      force?: boolean
    } = {}
    try {
      body = await req.json()
    } catch { /* no body — full generation mode */ }

    const format = await getExamFormat(id, user.id)
    if (!format) return NextResponse.json({ error: 'Format not found' }, { status: 404 })

    const ctx = await getCourseContext(format.course_id)
    const courseTree = await getCourseWithTree(format.course_id, user.id)

    // Flatten topics and build subject grouping for sibling lookups
    const courseSubjects = ((courseTree as unknown as { subjects?: Array<{ id: string; name: string; topics: Array<{ id: string; name: string; sort_order?: number }> }> }).subjects ?? [])
    const allTopics: Array<{ id: string; name: string; subjectName?: string }> = []
    for (const subject of courseSubjects) {
      for (const topic of subject.topics ?? []) {
        allTopics.push({ id: topic.id, name: topic.name, subjectName: subject.name })
      }
    }

    if (allTopics.length === 0) {
      return NextResponse.json({ error: 'Course has no topics' }, { status: 400 })
    }

    // Batch mode: generate a fixed count distributed across sections
    if (body.count !== undefined || body.batch) {
      const { count = 5, difficulty = 3, subjectId, topicId, chapterId } = body

      let topics: Array<{ id: string; name: string; subjectName?: string; chapterName?: string; priorChapters?: string[]; laterChapters?: string[]; chapterContent?: string }>
      if (chapterId) {
        const svc = await (await import('@/lib/supabase/server')).createServiceClient()
        // Fetch chapter name AND its topic_id (in case topicId wasn't sent by client)
        const chapterResult = await svc.from('chapters').select('name, topic_id').eq('id', chapterId).single()
        const chapterName = chapterResult.data?.name
        // Use the chapter's own topic_id as the authoritative parent, fallback to request body
        const resolvedTopicId = chapterResult.data?.topic_id ?? topicId
        // Fetch sibling chapters + chapter summary content in parallel
        const [siblingsResult, chapterContent] = await Promise.all([
          resolvedTopicId
            ? svc.from('chapters').select('name').eq('topic_id', resolvedTopicId).order('sort_order', { ascending: true })
            : Promise.resolve({ data: [] as { name: string }[] }),
          (async () => {
            // Get the latest cached chapter summary to use as grounding content
            const lastDepth = await getLastCachedChapterDepth(user.id, chapterId)
            if (lastDepth !== null) {
              const cached = await getCachedChapterSummary(user.id, chapterId, lastDepth)
              return cached?.summary ?? null
            }
            return null
          })(),
        ])
        const allSiblingNames = (siblingsResult.data ?? []).map((c: { name: string }) => c.name)
        // Split into prior chapters (allowed) and later chapters (forbidden)
        const currentIdx = allSiblingNames.indexOf(chapterName ?? '')
        const priorChapters = currentIdx > 0 ? allSiblingNames.slice(0, currentIdx) : []
        const laterChapters = currentIdx >= 0 ? allSiblingNames.slice(currentIdx + 1) : allSiblingNames.filter(s => s !== chapterName)
        const parentTopicName = resolvedTopicId ? allTopics.find((t) => t.id === resolvedTopicId)?.name : undefined

        // If no cached summary, generate key points as grounding content
        let groundingContent: string | undefined = chapterContent ?? undefined
        if (!groundingContent && chapterName) {
          groundingContent = await generateChapterKeyPoints({
            chapterName,
            topicName: parentTopicName ?? chapterName,
            courseName: ctx?.name ?? 'Course',
            siblingChapters: allSiblingNames.filter(s => s !== chapterName),
          }) || undefined
        }

        console.log(`[examQ route] chapterId=${chapterId}, chapterName="${chapterName}", resolvedTopicId=${resolvedTopicId}, parentTopic="${parentTopicName}", prior=[${priorChapters.join(', ')}], later=[${laterChapters.join(', ')}], contentSource=${chapterContent ? 'cached' : groundingContent ? 'generated' : 'none'} (${groundingContent?.length ?? 0} chars)`)
        if (chapterName) {
          topics = [{ id: resolvedTopicId ?? chapterId, name: parentTopicName ?? chapterName, subjectName: parentTopicName, chapterName, priorChapters, laterChapters, chapterContent: groundingContent ?? undefined }]
        } else {
          const matched = resolvedTopicId ? allTopics.filter((t) => t.id === resolvedTopicId) : []
          topics = matched.length > 0 ? matched : allTopics
        }
      } else if (topicId) {
        // Topic-level generation (no chapter) — apply boundary enforcement
        // using all other topics in the course as the forbidden list
        const matched = allTopics.find((t) => t.id === topicId)
        if (matched) {
          const otherTopicNames = allTopics
            .filter(t => t.id !== topicId)
            .map(t => t.name)

          // Fetch cached topic summary for grounding
          let groundingContent: string | undefined
          const lastDepth = await getLastCachedDepth(user.id, topicId)
          if (lastDepth !== null) {
            const cached = await getCachedSummary(user.id, topicId, lastDepth)
            groundingContent = cached?.summary ?? undefined
          }
          if (!groundingContent) {
            groundingContent = await generateChapterKeyPoints({
              chapterName: matched.name,
              topicName: matched.subjectName ?? matched.name,
              courseName: ctx?.name ?? 'Course',
              siblingChapters: otherTopicNames,
            }) || undefined
          }

          console.log(`[examQ route] topic-level: topicId=${topicId}, name="${matched.name}", subject="${matched.subjectName}", forbidden=[${otherTopicNames.join(', ')}], grounding=${groundingContent ? `${groundingContent.length} chars` : 'none'}`)

          // Reuse chapterName/laterChapters fields for boundary enforcement
          topics = [{
            id: topicId,
            name: matched.subjectName ?? matched.name,
            subjectName: matched.subjectName,
            chapterName: matched.name,
            priorChapters: [],
            laterChapters: otherTopicNames,
            chapterContent: groundingContent,
          }]
        } else {
          topics = allTopics
        }
      } else if (subjectId) {
        // Subject-level generation — include all topics under this subject
        const subjectTopics = courseSubjects.find(s => s.id === subjectId)?.topics ?? []
        if (subjectTopics.length > 0) {
          const subjectTopicIds = new Set(subjectTopics.map(t => t.id))
          const otherTopicNames = allTopics
            .filter(t => !subjectTopicIds.has(t.id))
            .map(t => t.name)

          console.log(`[examQ route] subject-level: subjectId=${subjectId}, topics=[${subjectTopics.map(t => t.name).join(', ')}], forbidden=[${otherTopicNames.join(', ')}]`)

          topics = subjectTopics.map(t => ({
            id: t.id,
            name: t.name,
            subjectName: courseSubjects.find(s => s.id === subjectId)?.name,
          }))
        } else {
          topics = allTopics
        }
      } else {
        topics = allTopics
      }

      const clampedDifficulty = Math.max(1, Math.min(5, difficulty))

      // Check DB cache: if we already have questions for this topic+difficulty, return them
      // Skip cache if force=true (explicit regenerate)
      const scopeTopicId = topicId ?? chapterId ?? subjectId
      if (scopeTopicId && !body.force) {
        const cached = await getExamQuestionsByTopicAndDepth(id, scopeTopicId, clampedDifficulty, Math.min(count, 20))
        if (cached.length > 0) {
          console.log(`[examQ route] DB cache hit: ${cached.length} questions for topic=${scopeTopicId}, difficulty=${clampedDifficulty}`)
          return NextResponse.json({ count: cached.length, questions: cached, _cached: true })
        }
      }

      const generated = await generateExamQuestions({
        sections: format.sections,
        topics,
        courseName: ctx?.name ?? 'Course',
        examName: format.name,
        yearOfStudy: ctx?.yearOfStudy,
        batchCount: Math.min(count, 20),
        difficulty: clampedDifficulty,
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
        depth: clampedDifficulty,
      })))

      const questions = questionsWithIds.map((q) => {
        const section = sectionMap[q.section_id]
        return {
          id: q._id,
          exam_format_id: id,
          section_id: q.section_id,
          section_name: section?.name ?? '',
          section_question_type: section?.question_type ?? '',
          topic_id: q.topic_id,
          topic_name: q.topic_id ? topicNameMap[q.topic_id] : undefined,
          course_id: format.course_id,
          question_text: q.question_text,
          dataset: q.dataset,
          options: q.options,
          correct_option_index: q.correct_option_index,
          max_marks: q.max_marks,
          mark_scheme: q.mark_scheme,
          depth: clampedDifficulty,
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
