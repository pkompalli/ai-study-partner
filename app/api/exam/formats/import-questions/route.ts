import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createExamFormat, getExamFormat } from '@/lib/db/examBank'
import type { ExtractedSection } from '@/lib/llm/examQuestionGenerator'

// POST /api/exam/formats/import-questions — create exam format from extracted paper sections
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      courseId?: string
      name?: string
      total_marks?: number
      time_minutes?: number
      instructions?: string
      sections?: ExtractedSection[]
    }

    const { courseId, name, total_marks, time_minutes, instructions, sections } = body
    if (!courseId || !name || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: 'courseId, name, and sections required' }, { status: 400 })
    }

    const format = await createExamFormat(user.id, courseId, {
      name,
      total_marks,
      time_minutes,
      instructions,
      sections: sections.map((s) => ({
        name: s.name,
        question_type: s.question_type,
        num_questions: s.num_questions,
        marks_per_question: s.marks_per_question,
        instructions: s.instructions,
      })),
    })

    const full = await getExamFormat(format.id, user.id)
    return NextResponse.json(full, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
