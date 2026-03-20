import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatCompletion } from '@/lib/llm/client'
import { checkRateLimit } from '@/lib/server/rateLimit'

// POST /api/homework/hint — get a hint for a homework problem
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = checkRateLimit(`homework-hint:${user.id}`, { limit: 30, windowMs: 60_000 })
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many requests.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const { questionText, answerText, hintsUsed, workedSolution } = await req.json() as {
      questionText: string
      answerText?: string
      hintsUsed?: number
      workedSolution?: string
    }

    if (!questionText) {
      return NextResponse.json({ error: 'questionText required' }, { status: 400 })
    }

    const hintNum = (hintsUsed ?? 0) + 1
    const prompt = `You are a supportive tutor helping a student with homework.

Question: ${questionText}
${answerText ? `Student's current answer so far: ${answerText}` : 'The student has not started answering yet.'}

This is hint #${hintNum} (max 3).
${hintNum === 1 ? 'Give a gentle nudge — point them in the right direction without revealing the answer. Ask a guiding question.' : ''}
${hintNum === 2 ? 'Be more specific — outline the approach or method they should use, but don\'t solve it for them.' : ''}
${hintNum === 3 ? 'Give a strong hint — walk them through most of the logic, leaving only the final step for them.' : ''}

Keep the hint concise (2-4 sentences). Be encouraging.`

    const hint = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, maxTokens: 300 },
    )

    return NextResponse.json({ hint: hint.trim() })
  } catch (err: unknown) {
    console.error('[homework-hint] ERROR:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
