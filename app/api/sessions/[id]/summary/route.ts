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

    // When depth=0, restore last viewed depth from cache
    let depth: number
    if (rawDepth === 0) {
      let lastDepth: number | null = null
      if (session.chapter_id) {
        lastDepth = await getLastCachedChapterDepth(user.id, session.chapter_id)
      }
      if (lastDepth === null && session.topic_id) {
        lastDepth = await getLastCachedDepth(user.id, session.topic_id)
      }
      depth = lastDepth ?? 1
    } else {
      depth = Math.max(1, Math.min(5, rawDepth))
    }

    // Check cache (chapter-level first, then topic-level) unless force=true
    if (!force) {
      let cached = null
      if (session.chapter_id) {
        cached = await getCachedChapterSummary(user.id, session.chapter_id, depth)
      }
      if (!cached && session.topic_id) {
        cached = await getCachedSummary(user.id, session.topic_id, depth)
      }

      if (cached) {
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
                question: cached.question,
                answerPills: cached.answer_pills,
                correctIndex: cached.correct_index,
                explanation: cached.explanation,
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
    let topicName = 'General'
    let chapterName: string | undefined

    if (session.topic_id) {
      const { data } = await svc.from('topics').select('name').eq('id', session.topic_id).single()
      if (data) topicName = data.name
    }
    if (session.chapter_id) {
      const { data } = await svc.from('chapters').select('name').eq('id', session.chapter_id).single()
      if (data) chapterName = data.name
    }

    const courseCtx = await getCourseContext(session.course_id).catch(() => null)

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
              question: final.question,
              answerPills: final.answerPills,
              correctIndex: final.correctIndex,
              explanation: final.explanation,
              starters: final.starters,
            })}\n\n`
          ))

          // Save to cache in the background
          const cachePayload = {
            summary: final.summary,
            question: final.question,
            answer_pills: final.answerPills,
            correct_index: final.correctIndex,
            explanation: final.explanation,
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
