import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refineCourseStructure } from '@/lib/llm/courseExtractor'
import { checkRateLimit } from '@/lib/server/rateLimit'

// POST /api/courses/extract/refine — refine course structure based on user feedback
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = checkRateLimit(`course-refine:${user.id}`, { limit: 15, windowMs: 60_000 })
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many refinement requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const body = await req.json()
    const { structure, feedback } = body as { structure?: unknown; feedback?: string }

    if (!structure || !feedback?.trim()) {
      return NextResponse.json({ error: 'Missing structure or feedback' }, { status: 400 })
    }

    const refined = await refineCourseStructure(structure as Parameters<typeof refineCourseStructure>[0], feedback)

    return NextResponse.json({ structure: refined })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
