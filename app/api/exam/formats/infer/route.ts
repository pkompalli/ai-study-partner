import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCourseContext } from '@/lib/db/courses'
import { inferExamFormat } from '@/lib/llm/examQuestionGenerator'

// POST /api/exam/formats/infer — infer exam format from exam name via LLM
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { courseId?: string; examName?: string }
    const { courseId, examName } = body
    if (!courseId || !examName) {
      return NextResponse.json({ error: 'courseId and examName required' }, { status: 400 })
    }

    const ctx = await getCourseContext(courseId)
    const inferred = await inferExamFormat(examName, ctx?.name ?? 'Course')
    return NextResponse.json(inferred)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
