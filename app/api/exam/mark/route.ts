import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExamQuestionById, getUserScoringRubric } from '@/lib/db/examBank'
import { markAnswer } from '@/lib/llm/examMarker'
import { checkRateLimit } from '@/lib/server/rateLimit'
import { validateUploadedFiles } from '@/lib/server/uploadValidation'
import { apiErrorResponse, getRequestId, logApiError } from '@/lib/server/apiError'

function parseSelectedOptionIndex(value: FormDataEntryValue | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

// POST /api/exam/mark — standalone question marking (supports multipart uploads)
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = checkRateLimit(`exam-mark:${user.id}`, { limit: 20, windowMs: 60_000 })
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many marking requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const contentType = req.headers.get('content-type') ?? ''
    let questionId: string | undefined
    let answerText: string | undefined
    let selectedOptionIndex: number | undefined
    let files: File[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      questionId = (formData.get('questionId') as string | null) ?? undefined
      answerText = (formData.get('answerText') as string | null) ?? undefined
      selectedOptionIndex = parseSelectedOptionIndex(formData.get('selectedOptionIndex'))
      files = formData.getAll('files').filter((file): file is File => file instanceof File)
      const uploadError = validateUploadedFiles(files, {
        maxFiles: 10,
        maxFileSizeBytes: 20 * 1024 * 1024,
        allowedTypes: ['image/*', 'application/pdf'],
      })
      if (uploadError) return NextResponse.json({ error: uploadError }, { status: 400 })
    } else {
      const body = await req.json() as {
        questionId?: string
        answerText?: string
        selectedOptionIndex?: number
      }
      questionId = body.questionId
      answerText = body.answerText
      selectedOptionIndex = parseSelectedOptionIndex(body.selectedOptionIndex)
    }

    if (!questionId) {
      return NextResponse.json({ error: 'questionId required' }, { status: 400 })
    }

    const question = await getExamQuestionById(questionId)
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

    const isMcq = question.section_question_type === 'mcq'
    let images: { base64: string; mimeType: string }[] | undefined
    let pdfTextAppend = ''

    if (!isMcq && files.length > 0) {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'))
      const pdfFiles = files.filter((file) => file.type === 'application/pdf')

      if (imageFiles.length > 0) {
        images = await Promise.all(
          imageFiles.map(async (file) => ({
            base64: Buffer.from(await file.arrayBuffer()).toString('base64'),
            mimeType: file.type,
          })),
        )
      }

      for (const pdfFile of pdfFiles) {
        try {
          const { extractTextFromPDF } = await import('@/lib/llm/examQuestionGenerator')
          const text = await extractTextFromPDF(Buffer.from(await pdfFile.arrayBuffer()))
          if (text.trim()) pdfTextAppend += (pdfTextAppend ? '\n' : '') + text
        } catch {
          // Ignore PDF extraction errors and continue with available answer text.
        }
      }
    }

    const studentAnswer = isMcq
      ? (question.options?.[selectedOptionIndex ?? -1] ?? answerText ?? '')
      : ((answerText ?? '') + (pdfTextAppend ? `\n\n[Uploaded document content:]\n${pdfTextAppend}` : ''))

    const customRubric = await getUserScoringRubric(user.id)
    const result = await markAnswer({
      questionText: question.question_text,
      questionType: question.section_question_type,
      dataset: question.dataset,
      markScheme: question.mark_scheme,
      maxMarks: question.max_marks,
      studentAnswer,
      customRubric: customRubric || undefined,
      correctOptionIndex: question.correct_option_index,
      selectedOptionIndex,
      images,
    })

    return NextResponse.json({ score: result.score, maxMarks: question.max_marks, feedback: result.feedback })
  } catch (err: unknown) {
    logApiError({ route: 'exam/mark.POST', requestId, req, err })
    const message = err instanceof Error ? err.message : 'Internal error'
    return apiErrorResponse(message, 500, requestId)
  }
}
