import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCourseContext } from '@/lib/db/courses'
import { inferExamFormat, inferExamFormatFromDescription } from '@/lib/llm/examQuestionGenerator'

// POST /api/exam/formats/infer — infer exam format from exam name or free text description
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { courseId?: string; examName?: string; description?: string }
    const { courseId, examName, description } = body
    if (!courseId) {
      return NextResponse.json({ error: 'courseId required' }, { status: 400 })
    }
    if (!examName && !description) {
      return NextResponse.json({ error: 'examName or description required' }, { status: 400 })
    }

    const ctx = await getCourseContext(courseId)
    const courseName = ctx?.name ?? 'Course'

    const inferred = description?.trim()
      ? await inferExamFormatFromDescription(description.trim(), courseName)
      : await inferExamFormat(examName!, courseName)

    return NextResponse.json(inferred)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
