import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionById } from '@/lib/db/sessions'
import { getCourseContext } from '@/lib/db/courses'
import { streamTopicSummaryGenerator } from '@/lib/llm/summaryGenerator'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/sessions/[id]/summary?depth=0&force=true — stream topic summary as SSE
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { id } = await params
  const rawDepth = parseInt(req.nextUrl.searchParams.get('depth') ?? '0', 10) || 0
  const depth = rawDepth === 0 ? 1 : Math.max(1, Math.min(5, rawDepth))

  const session = await getSessionById(id, user.id)
  if (!session) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

  // Resolve topic and chapter names
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

        // result.value is now SummaryInteractiveResult
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
}
