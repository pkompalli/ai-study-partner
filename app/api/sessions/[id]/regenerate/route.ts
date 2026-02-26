import { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSessionById, getSessionMessages, saveMessage } from '@/lib/db/sessions'
import { getCourseContext } from '@/lib/db/courses'
import { streamTutorResponseGenerator } from '@/lib/llm/tutor'

// POST /api/sessions/[id]/regenerate — regenerate the AI response at a given message index
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const { id } = await params
  const { messageIndex, depth } = await req.json() as { messageIndex?: number; depth?: number }

  const session = await getSessionById(id, user.id)
  if (!session) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })

  const messages = await getSessionMessages(id)
  // Find the user message just before the AI response at messageIndex
  const nonSystemMessages = messages.filter((m) => m.role !== 'system')
  const targetAI = nonSystemMessages[messageIndex ?? nonSystemMessages.length - 1]
  if (!targetAI || targetAI.role !== 'assistant') {
    return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404 })
  }

  // Find the user message that prompted this AI response
  const aiPosInAll = messages.indexOf(targetAI)
  const prevUser = messages.slice(0, aiPosInAll).reverse().find((m) => m.role === 'user')
  if (!prevUser) return new Response(JSON.stringify({ error: 'No user message found' }), { status: 400 })

  // Resolve topic/chapter names and course context
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

  // History up to (but not including) the message being regenerated
  const historyUpTo = messages.slice(0, aiPosInAll)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const gen = streamTutorResponseGenerator(
          typeof prevUser.content === 'string' ? prevUser.content : '',
          historyUpTo,
          {
            courseName: courseCtx?.name ?? 'Course',
            topicName,
            chapterName,
            goal: courseCtx?.goal,
            yearOfStudy: courseCtx?.yearOfStudy,
            examName: courseCtx?.examName,
            depth: depth ?? 1,
          },
        )

        let result = await gen.next()
        while (!result.done) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'chunk', content: result.value })}\n\n`
          ))
          result = await gen.next()
        }

        const fullContent = result.value
        // Update the existing message in DB with regenerated content (best-effort)
        if (targetAI.id) {
          await svc.from('session_messages')
            .update({ content: fullContent })
            .eq('id', targetAI.id)
        }

        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`
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
