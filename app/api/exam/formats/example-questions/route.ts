import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCourseContext } from '@/lib/db/courses'
import { generateExampleQuestions } from '@/lib/llm/examQuestionGenerator'

// POST /api/exam/formats/example-questions — generate preview questions for format setup
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      courseId: string
      examName?: string
      sections: Array<{ name: string; question_type: string; marks_per_question?: number; num_options?: number }>
    }

    if (!body.courseId || !body.sections?.length) {
      return NextResponse.json({ error: 'courseId and sections required' }, { status: 400 })
    }

    const ctx = await getCourseContext(body.courseId)
    const courseName = ctx?.name ?? 'Course'

    const examples = await generateExampleQuestions({
      sections: body.sections,
      courseName,
      examName: body.examName,
    })

    return NextResponse.json({ examples })
  } catch (err: unknown) {
    console.error('[example-questions] ERROR:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
