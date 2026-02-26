import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getSessionById,
  getSessionMessages,
  saveMessage,
  saveQuiz,
  saveFlashcardSet,
} from '@/lib/db/sessions'
import {
  getTopicCards,
  getTopicCardFronts,
  saveTopicCards,
  getTopicCheckQuestions,
  reviewTopicCard,
  getCrossTopicCards,
  saveSummaryCache,
  saveChapterSummaryCache,
  getCachedSummary,
  getCachedChapterSummary,
  getLastCachedDepth,
  getLastCachedChapterDepth,
} from '@/lib/db/topicBank'
import { getCourseContext } from '@/lib/db/courses'
import { streamTutorResponseGenerator } from '@/lib/llm/tutor'
import { generateQuiz } from '@/lib/llm/quizGenerator'
import { generateFlashcards } from '@/lib/llm/flashcardGenerator'
import { streamTopicSummaryGenerator } from '@/lib/llm/summaryGenerator'
import { generateResponsePills } from '@/lib/llm/pillsGenerator'
import { fetchVideoLinks } from '@/lib/youtube'
import { inferAcademicLevel } from '@/lib/llm/prompts'
import { checkRateLimit } from '@/lib/server/rateLimit'
import { apiErrorResponse, getRequestId, logApiError } from '@/lib/server/apiError'

// Helper to get topic and chapter names from IDs
async function resolveNames(topicId?: string | null, chapterId?: string | null) {
  const svc = await createServiceClient()
  let topicName = 'General'
  let chapterName: string | undefined

  if (topicId) {
    const { data } = await svc.from('topics').select('name').eq('id', topicId).single()
    if (data) topicName = data.name
  }
  if (chapterId) {
    const { data } = await svc.from('chapters').select('name').eq('id', chapterId).single()
    if (data) chapterName = data.name
  }

  return { topicName, chapterName }
}

// GET /api/sessions/[id]/messages — various session data endpoints
// query params: type=quiz|flashcards|pills|summary|topic-cards|topic-questions|cross-topic-cards
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
    const type = req.nextUrl.searchParams.get('type')

    const session = await getSessionById(id, user.id)
    const topicId = session.topic_id ?? undefined
    const chapterId = session.chapter_id ?? undefined

    if (type === 'topic-cards') {
      if (!topicId) return NextResponse.json({ cards: [] })
      const cards = await getTopicCards(user.id, topicId, chapterId)
      return NextResponse.json({ cards })
    }

    if (type === 'topic-questions') {
      if (!topicId) return NextResponse.json({ questions: [] })
      const questions = await getTopicCheckQuestions(user.id, topicId, chapterId)
      return NextResponse.json({ questions })
    }

    if (type === 'cross-topic-cards') {
      if (!topicId) return NextResponse.json({ cards: [] })
      const { topicName } = await resolveNames(topicId)
      const cards = await getCrossTopicCards(user.id, session.course_id, topicId, topicName)
      return NextResponse.json({ cards })
    }

    if (type === 'pills') {
      const courseCtx = await getCourseContext(session.course_id)
      const messages = await getSessionMessages(id)
      const lastAssistant = [...messages].reverse().find(
        (m) => m.role === 'assistant' && m.content_type !== 'quiz' && m.content_type !== 'flashcards' && m.content_type !== 'videos',
      )
      if (!lastAssistant) return NextResponse.json({ questions: [], followupPills: [] })

      const { topicName } = await resolveNames(topicId)
      const level = inferAcademicLevel(courseCtx?.yearOfStudy, courseCtx?.name)
      const result = await generateResponsePills(lastAssistant.content, topicName, level.label)
      return NextResponse.json(result)
    }

    if (type === 'summary') {
      const limit = checkRateLimit(`summary:${user.id}:${id}`, { limit: 20, windowMs: 60_000 })
      if (limit.limited) {
        return NextResponse.json(
          { error: 'Too many summary requests. Please wait a moment.' },
          { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
        )
      }

      const rawDepth = parseInt(req.nextUrl.searchParams.get('depth') ?? '0', 10) || 0
      const force = req.nextUrl.searchParams.get('force') === 'true'

      // Determine effective depth
      let depth: number
      if (rawDepth === 0) {
        const lastDepth = chapterId
          ? (await getLastCachedChapterDepth(user.id, chapterId) ?? (topicId ? await getLastCachedDepth(user.id, topicId) : null))
          : (topicId ? await getLastCachedDepth(user.id, topicId) : null)
        depth = lastDepth ?? 1
      } else {
        depth = Math.max(1, Math.min(5, rawDepth || 1))
      }

      // Serve from cache if available
      const cached = force ? null : (chapterId
        ? await getCachedChapterSummary(user.id, chapterId, depth)
        : (topicId ? await getCachedSummary(user.id, topicId, depth) : null))

      if (cached) {
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: cached.summary })}\n\n`))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'done',
              depth,
              question: cached.question,
              answerPills: cached.answer_pills,
              correctIndex: cached.correct_index,
              explanation: cached.explanation,
              starters: cached.starters,
            })}\n\n`))
            controller.close()
          },
        })
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      }

      // Cache miss — generate via LLM
      const courseCtx = await getCourseContext(session.course_id)
      const { topicName, chapterName } = await resolveNames(topicId, chapterId)

      const generator = streamTopicSummaryGenerator({
        courseName: courseCtx?.name ?? 'Course',
        topicName,
        chapterName,
        yearOfStudy: courseCtx?.yearOfStudy,
        examName: courseCtx?.examName,
        goal: courseCtx?.goal,
        depth,
      })

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            let result: Awaited<ReturnType<typeof generator.next>>
            while (!(result = await generator.next()).done) {
              const chunk = result.value as string
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`))
            }
            const finalResult = result.value
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'done',
              depth,
              question: finalResult.question,
              answerPills: finalResult.answerPills,
              correctIndex: finalResult.correctIndex,
              explanation: finalResult.explanation,
              starters: finalResult.starters,
            })}\n\n`))

            // Persist to cache
            const cacheData = {
              summary: finalResult.summary,
              question: finalResult.question,
              answer_pills: finalResult.answerPills,
              correct_index: finalResult.correctIndex,
              explanation: finalResult.explanation,
              starters: finalResult.starters,
            }
            if (chapterId) {
              await saveChapterSummaryCache(user.id, chapterId, depth, cacheData)
            } else if (topicId) {
              await saveSummaryCache(user.id, topicId, depth, cacheData)
            }
          } finally {
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // Default: return all messages
    const messages = await getSessionMessages(id)
    return NextResponse.json(messages)
  } catch (err: unknown) {
    logApiError({ route: 'sessions/[id]/messages.GET', requestId, req, err })
    const message = err instanceof Error ? err.message : 'Internal error'
    return apiErrorResponse(message, 500, requestId)
  }
}

// POST /api/sessions/[id]/messages — send message, request quiz/flashcards/videos, review card, etc.
// Body must include 'type' discriminator:
//   { type: 'message', content, depth? }
//   { type: 'quiz' }
//   { type: 'flashcards', depth? }
//   { type: 'videos' }
//   { type: 'regenerate', messageIndex, depth }
//   { type: 'save-card', question, answer, explanation }
//   { type: 'review-card', cardId, correct }
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
    const body = await req.json() as {
      type: string
      content?: string
      depth?: number
      messageIndex?: number
      question?: string
      answer?: string
      explanation?: string
      cardId?: string
      correct?: boolean
    }

    const llmHeavyTypes = new Set(['message', 'quiz', 'flashcards', 'videos', 'regenerate'])
    if (llmHeavyTypes.has(body.type)) {
      const limit = checkRateLimit(`session-llm:${user.id}:${id}`, { limit: 30, windowMs: 60_000 })
      if (limit.limited) {
        return NextResponse.json(
          { error: 'Too many AI requests. Please wait a moment.' },
          { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
        )
      }
    }

    const session = await getSessionById(id, user.id)
    const topicId = session.topic_id ?? undefined
    const chapterId = session.chapter_id ?? undefined

    // ── review-card ────────────────────────────────────────────────────────────
    if (body.type === 'review-card') {
      const { cardId, correct } = body
      if (!cardId || correct === undefined) {
        return NextResponse.json({ error: 'cardId and correct required' }, { status: 400 })
      }
      const result = await reviewTopicCard(user.id, cardId, correct)
      if (!result) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
      return NextResponse.json(result)
    }

    // ── save-card ──────────────────────────────────────────────────────────────
    if (body.type === 'save-card') {
      if (!topicId) return NextResponse.json({ error: 'Session has no topic' }, { status: 400 })
      const { question, answer, explanation } = body
      if (!question || !answer) return NextResponse.json({ error: 'question and answer required' }, { status: 400 })

      const back = explanation ? `${answer}\n\n${explanation}` : answer
      await saveTopicCards(user.id, topicId, session.course_id, id, 0, [{ front: question, back }], chapterId)

      // Retrieve the just-saved card
      const cards = await getTopicCards(user.id, topicId, chapterId)
      const saved = cards[cards.length - 1]
      if (!saved) return NextResponse.json({ error: 'Failed to save card' }, { status: 500 })
      return NextResponse.json({ card: saved })
    }

    // ── quiz ───────────────────────────────────────────────────────────────────
    if (body.type === 'quiz') {
      const messages = await getSessionMessages(id)
      const { topicName } = await resolveNames(topicId)
      const questions = await generateQuiz(topicName, messages)
      const quizId = await saveQuiz(id, user.id, topicId, questions)
      await saveMessage(id, 'assistant', 'Here is your quiz!', 'quiz', { quizId, questions })
      return NextResponse.json({ id: quizId, questions })
    }

    // ── flashcards ─────────────────────────────────────────────────────────────
    if (body.type === 'flashcards') {
      const depth = typeof body.depth === 'number' ? body.depth : 0
      const messages = await getSessionMessages(id)
      const { topicName, chapterName } = await resolveNames(topicId, chapterId)
      const flashcardContext = chapterName ? `${topicName} — ${chapterName}` : topicName
      const existingFronts = topicId ? await getTopicCardFronts(user.id, topicId, chapterId) : []
      const newCards = await generateFlashcards(flashcardContext, messages, existingFronts)

      if (topicId && newCards.length > 0) {
        await saveTopicCards(user.id, topicId, session.course_id, id, depth, newCards, chapterId)
      }

      const setId = await saveFlashcardSet(id, user.id, topicId, newCards)
      await saveMessage(id, 'assistant', 'Here are your flashcards!', 'flashcards', { setId, cards: newCards })

      const allCards = topicId ? await getTopicCards(user.id, topicId, chapterId) : newCards
      return NextResponse.json({ id: setId, cards: allCards })
    }

    // ── videos ─────────────────────────────────────────────────────────────────
    if (body.type === 'videos') {
      const { topicName, chapterName } = await resolveNames(topicId, chapterId)
      const videos = await fetchVideoLinks(topicName, chapterName)
      await saveMessage(id, 'assistant', 'Here are some helpful videos!', 'videos', { videos })
      return NextResponse.json({ videos })
    }

    // ── regenerate ─────────────────────────────────────────────────────────────
    if (body.type === 'regenerate') {
      const { messageIndex, depth } = body
      if (messageIndex === undefined) return NextResponse.json({ error: 'messageIndex required' }, { status: 400 })

      const courseCtx = await getCourseContext(session.course_id)
      const { topicName, chapterName } = await resolveNames(topicId, chapterId)

      const allMessages = await getSessionMessages(id)
      const visibleMessages = allMessages.filter((m) => m.role !== 'system')

      if (messageIndex < 1 || messageIndex >= visibleMessages.length) {
        return NextResponse.json({ error: 'Invalid messageIndex' }, { status: 400 })
      }

      const userMsg = visibleMessages[messageIndex - 1]
      if (!userMsg || userMsg.role !== 'user') {
        return NextResponse.json({ error: 'No preceding user message found' }, { status: 400 })
      }

      const historyBeforeUser = visibleMessages.slice(0, messageIndex - 1)
      const generator = streamTutorResponseGenerator(userMsg.content, historyBeforeUser, {
        courseName: courseCtx?.name ?? 'Course',
        topicName,
        chapterName,
        goal: courseCtx?.goal,
        yearOfStudy: courseCtx?.yearOfStudy,
        examName: courseCtx?.examName,
        depth: depth ?? 0,
      })

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            let result: Awaited<ReturnType<typeof generator.next>>
            while (!(result = await generator.next()).done) {
              const chunk = result.value as string
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`))
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          } finally {
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      })
    }

    // ── message (default) ──────────────────────────────────────────────────────
    const { content, depth } = body
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

    const courseCtx = await getCourseContext(session.course_id)
    const { topicName, chapterName } = await resolveNames(topicId, chapterId)

    await saveMessage(id, 'user', content)
    const history = await getSessionMessages(id)

    const generator = streamTutorResponseGenerator(content, history, {
      courseName: courseCtx?.name ?? 'Course',
      topicName,
      chapterName,
      goal: courseCtx?.goal,
      yearOfStudy: courseCtx?.yearOfStudy,
      examName: courseCtx?.examName,
      depth,
    })

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let assistantContent = ''
        try {
          let result: Awaited<ReturnType<typeof generator.next>>
          while (!(result = await generator.next()).done) {
            const chunk = result.value as string
            assistantContent += chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`))
          }
          // Save BEFORE signalling done so fetchPills always finds the message
          await saveMessage(id, 'assistant', assistantContent)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (err: unknown) {
    logApiError({ route: 'sessions/[id]/messages.POST', requestId, req, err })
    const message = err instanceof Error ? err.message : 'Internal error'
    return apiErrorResponse(message, 500, requestId)
  }
}
