import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionById } from '@/lib/db/sessions'
import { getCourseContext } from '@/lib/db/courses'
import { streamTopicSummaryGenerator } from '@/lib/llm/summaryGenerator'
import { createServiceClient } from '@/lib/supabase/server'
import { apiErrorResponse, getRequestId, logApiError } from '@/lib/server/apiError'
import {
  getCachedSummary,
  getLastCachedDepth,
  saveSummaryCache,
  getCachedChapterSummary,
  getLastCachedChapterDepth,
  saveChapterSummaryCache,
} from '@/lib/db/topicBank'

// GET /api/sessions/[id]/summary?depth=0&force=true — stream topic summary as SSE
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(req)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const { id } = await params
    const force = req.nextUrl.searchParams.get('force') === 'true'
    const rawDepth = parseInt(req.nextUrl.searchParams.get('depth') ?? '0', 10) || 0

    const session = await getSessionById(id, user.id)
    if (!session) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

    // When depth=0, restore last viewed depth from cache — run both lookups in parallel
    let depth: number
    if (rawDepth === 0) {
      const [chapterDepth, topicDepth] = await Promise.all([
        session.chapter_id ? getLastCachedChapterDepth(user.id, session.chapter_id) : null,
        session.topic_id ? getLastCachedDepth(user.id, session.topic_id) : null,
      ])
      depth = chapterDepth ?? topicDepth ?? 1
    } else {
      depth = Math.max(1, Math.min(5, rawDepth))
    }

    // Check cache (chapter-level and topic-level in parallel) unless force=true
    // Subject-level sessions are never cached (they aggregate multiple topics)
    if (!force && !session.subject_id) {
      const [chapterCached, topicCached] = await Promise.all([
        session.chapter_id ? getCachedChapterSummary(user.id, session.chapter_id, depth) : null,
        session.topic_id ? getCachedSummary(user.id, session.topic_id, depth) : null,
      ])
      const cached = chapterCached ?? topicCached

      if (cached) {
        // Reconstruct questions array from cache
        let cachedQuestions: Array<{ question: string; answerPills: string[]; correctIndex: number; explanation: string }> = []
        try {
          const parsed = JSON.parse(cached.question)
          if (Array.isArray(parsed)) cachedQuestions = parsed
        } catch {
          // Old single-question cache format
          if (cached.question) {
            cachedQuestions = [{ question: cached.question, answerPills: cached.answer_pills, correctIndex: cached.correct_index, explanation: cached.explanation }]
          }
        }

        // Stream the cached summary back as SSE so the client handles it identically
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'chunk', content: cached.summary })}\n\n`
            ))
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                depth: cached.depth,
                questions: cachedQuestions,
                starters: cached.starters,
              })}\n\n`
            ))
            controller.close()
          },
        })
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      }
    }

    // Cache miss or force=true — generate via LLM
    const svc = await createServiceClient()
    // Fetch subject name, topic name, chapter name, and course context in parallel
    const [subjectResult, topicResult, chapterResult, courseCtx] = await Promise.all([
      session.subject_id
        ? svc.from('subjects').select('name').eq('id', session.subject_id).single()
        : Promise.resolve({ data: null }),
      session.topic_id
        ? svc.from('topics').select('name').eq('id', session.topic_id).single()
        : Promise.resolve({ data: null }),
      session.chapter_id
        ? svc.from('chapters').select('name').eq('id', session.chapter_id).single()
        : Promise.resolve({ data: null }),
      getCourseContext(session.course_id).catch(() => null),
    ])
    // For subject-level sessions, the "topic" for the summary generator is the subject name
    const topicName = subjectResult.data?.name ?? topicResult.data?.name ?? 'General'
    const chapterName: string | undefined = chapterResult.data?.name ?? undefined

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const gen = streamTopicSummaryGenerator({
            courseName: courseCtx?.name ?? 'Course',
            topicName,
            chapterName,
            yearOfStudy: courseCtx?.yearOfStudy,
            examName: courseCtx?.examName,
            goal: courseCtx?.goal,
            depth,
          })

          let result = await gen.next()
          while (!result.done) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'chunk', content: result.value })}\n\n`
            ))
            result = await gen.next()
          }

          const final = result.value
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              depth,
              questions: final.questions,
              starters: final.starters,
            })}\n\n`
          ))

          // Save to cache in the background — store questions array as JSON in the question column
          const firstQ = final.questions[0]
          const cachePayload = {
            summary: final.summary,
            question: JSON.stringify(final.questions),
            answer_pills: firstQ?.answerPills ?? [],
            correct_index: firstQ?.correctIndex ?? -1,
            explanation: firstQ?.explanation ?? '',
            starters: final.starters,
          }
          if (session.chapter_id) {
            saveChapterSummaryCache(user.id, session.chapter_id, depth, cachePayload).catch(() => {})
          } else if (session.topic_id) {
            saveSummaryCache(user.id, session.topic_id, depth, cachePayload).catch(() => {})
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: unknown) {
    logApiError({ route: 'sessions/[id]/summary.GET', requestId, req, err })
    const message = err instanceof Error ? err.message : 'Internal error'
    return apiErrorResponse(message, 500, requestId)
  }
}
