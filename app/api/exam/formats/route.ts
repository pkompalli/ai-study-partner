import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExamFormatsForCourse,
  createExamFormat,
  getExamFormat,
} from '@/lib/db/examBank'
import { getCourseContext } from '@/lib/db/courses'
import { inferExamFormat, extractExamFromPaper } from '@/lib/llm/examQuestionGenerator'
import type { ExtractedSection } from '@/lib/llm/examQuestionGenerator'

// GET /api/exam/formats?courseId=xxx — list exam formats for a course
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courseId = req.nextUrl.searchParams.get('courseId')
    if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

    const formats = await getExamFormatsForCourse(user.id, courseId)
    return NextResponse.json(formats)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/exam/formats — create a new exam format
// Also handles special actions:
//   { action: 'infer', courseId, examName } — infer format from exam name via LLM
//   { action: 'extract-paper' } with multipart files — extract format from paper
//   { action: 'import-questions', ... } — import extracted questions
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const contentType = req.headers.get('content-type') ?? ''

    // Handle multipart form data for paper extraction
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const files = formData.getAll('files') as File[]
      const singleFile = formData.get('file') as File | null

      let source: Parameters<typeof extractExamFromPaper>[0]

      if (singleFile) {
        const buffer = Buffer.from(await singleFile.arrayBuffer())
        if (singleFile.type === 'application/pdf') {
          source = { type: 'pdf', buffer }
        } else {
          source = { type: 'images', images: [{ base64: buffer.toString('base64'), mimeType: singleFile.type }] }
        }
      } else if (files.length > 0) {
        const pdfs = files.filter((f) => f.type === 'application/pdf')
        if (pdfs.length > 0) {
          const buffer = Buffer.from(await pdfs[0].arrayBuffer())
          source = { type: 'pdf', buffer }
        } else {
          const images = await Promise.all(
            files.map(async (f) => ({
              base64: Buffer.from(await f.arrayBuffer()).toString('base64'),
              mimeType: f.type,
            })),
          )
          source = { type: 'images', images }
        }
      } else {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      }

      const result = await extractExamFromPaper(source)
      return NextResponse.json(result)
    }

    // JSON body
    const body = await req.json() as {
      action?: string
      courseId?: string
      examName?: string
      name?: string
      description?: string
      total_marks?: number
      time_minutes?: number
      instructions?: string
      sections?: Array<{
        name: string
        question_type: string
        num_questions: number
        marks_per_question?: number
        total_marks?: number
        instructions?: string
      }>
      questions?: unknown[]
    }

    // Infer format from exam name
    if (body.action === 'infer') {
      const { courseId, examName } = body
      if (!courseId || !examName) {
        return NextResponse.json({ error: 'courseId and examName required' }, { status: 400 })
      }
      const ctx = await getCourseContext(courseId)
      const inferred = await inferExamFormat(examName, ctx?.name ?? 'Course')
      return NextResponse.json(inferred)
    }

    // Import extracted questions (creates format only — no verbatim question import)
    if (body.action === 'import-questions') {
      const { courseId, name, total_marks, time_minutes, instructions, sections } = body
      if (!courseId || !name || !Array.isArray(sections) || sections.length === 0) {
        return NextResponse.json({ error: 'courseId, name, and sections required' }, { status: 400 })
      }

      const format = await createExamFormat(user.id, courseId, {
        name,
        total_marks,
        time_minutes,
        instructions,
        sections: (sections as ExtractedSection[]).map((s) => ({
          name: s.name,
          question_type: s.question_type,
          num_questions: s.num_questions,
          marks_per_question: s.marks_per_question,
          instructions: s.instructions,
        })),
      })

      return NextResponse.json(format, { status: 201 })
    }

    // Create a new exam format
    const { courseId, name, sections } = body
    if (!courseId || !name || !Array.isArray(sections)) {
      return NextResponse.json({ error: 'courseId, name, and sections required' }, { status: 400 })
    }

    const formatId = await createExamFormat(user.id, courseId, body as Parameters<typeof createExamFormat>[2])
    const format = await getExamFormat(formatId.id, user.id)
    return NextResponse.json(format, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
