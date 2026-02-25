import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAttempt,
  getExamQuestions,
  getExamQuestionById,
  upsertAnswer,
  markAnswer as markAnswerDb,
  getUserScoringRubric,
} from '@/lib/db/examBank'
import { markAnswer, getHint, getFullAnswer } from '@/lib/llm/examMarker'

// POST /api/exam/attempts/[id]/answers — submit an answer for a question
// Body: { questionId, answerText?, selectedOptionIndex?, hintsUsed? }
// Special body action:
//   { action: 'hint', questionId, answerText? } — get a hint for a question
//   { action: 'mark-standalone', questionId, answerText?, selectedOptionIndex? } — standalone marking
//   { action: 'full-answer', questionId } — get full worked answer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const contentType = req.headers.get('content-type') ?? ''

    // Handle multipart for standalone marking with image uploads
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const action = formData.get('action') as string | null
      const questionId = formData.get('questionId') as string
      const answerText = formData.get('answerText') as string | null ?? undefined
      const selectedOptionIndexRaw = formData.get('selectedOptionIndex')
      const selectedOptionIndex = selectedOptionIndexRaw !== null ? Number(selectedOptionIndexRaw) : undefined
      const files = formData.getAll('files') as File[]

      if (action === 'mark-standalone' || !action) {
        const question = await getExamQuestionById(questionId)
        if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

        const isMcq = question.section_question_type === 'mcq'
        let images: { base64: string; mimeType: string }[] | undefined
        let pdfTextAppend = ''

        if (!isMcq && files.length > 0) {
          const imgFiles = files.filter((f) => f.type.startsWith('image/'))
          const pdfFiles = files.filter((f) => f.type === 'application/pdf')

          if (imgFiles.length > 0) {
            images = await Promise.all(
              imgFiles.map(async (f) => ({
                base64: Buffer.from(await f.arrayBuffer()).toString('base64'),
                mimeType: f.type,
              })),
            )
          }

          for (const pdfFile of pdfFiles) {
            try {
              const { extractTextFromPDF } = await import('@/lib/llm/examQuestionGenerator')
              const buffer = Buffer.from(await pdfFile.arrayBuffer())
              const text = await extractTextFromPDF(buffer)
              if (text.trim()) pdfTextAppend += (pdfTextAppend ? '\n' : '') + text
            } catch { /* ignore extraction errors */ }
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
      }

      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const body = await req.json() as {
      action?: string
      questionId: string
      answerText?: string
      selectedOptionIndex?: number
      hintsUsed?: number
    }

    const { action, questionId, answerText, selectedOptionIndex, hintsUsed } = body

    // ── hint ──────────────────────────────────────────────────────────────────
    if (action === 'hint') {
      const attempt = await getAttempt(id, user.id)
      if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

      const questions = await getExamQuestions(attempt.exam_format_id)
      const question = questions.find((q) => q.id === questionId)
      if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

      const existingAnswer = attempt.answers.find((a: { question_id: string; hints_used?: number }) => a.question_id === questionId)
      const hintsUsedCount = existingAnswer?.hints_used ?? 0

      const hint = await getHint({
        questionText: question.question_text,
        questionType: question.section_question_type,
        dataset: question.dataset,
        studentAnswer: answerText,
        hintsUsed: hintsUsedCount,
      })

      await upsertAnswer(id, questionId, answerText ?? (existingAnswer as { answer_text?: string | null })?.answer_text ?? null, hintsUsedCount + 1)
      return NextResponse.json({ hint, hintsUsed: hintsUsedCount + 1 })
    }

    // ── standalone hint (no attempt) ──────────────────────────────────────────
    if (action === 'hint-standalone') {
      const question = await getExamQuestionById(questionId)
      if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

      const hint = await getHint({
        questionText: question.question_text,
        questionType: question.section_question_type,
        dataset: question.dataset,
        studentAnswer: answerText,
        hintsUsed: hintsUsed ?? 0,
      })
      return NextResponse.json({ hint })
    }

    // ── full-answer (standalone, no attempt) ──────────────────────────────────
    if (action === 'full-answer') {
      const question = await getExamQuestionById(questionId)
      if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

      const answer = await getFullAnswer({
        questionText: question.question_text,
        questionType: question.section_question_type,
        dataset: question.dataset,
        markScheme: question.mark_scheme,
        maxMarks: question.max_marks,
      })
      return NextResponse.json({ answer })
    }

    // ── mark-standalone (no attempt) ──────────────────────────────────────────
    if (action === 'mark-standalone') {
      const question = await getExamQuestionById(questionId)
      if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

      const isMcq = question.section_question_type === 'mcq'
      const studentAnswer = isMcq
        ? (question.options?.[selectedOptionIndex ?? -1] ?? answerText ?? '')
        : (answerText ?? '')

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
      })
      return NextResponse.json({ score: result.score, maxMarks: question.max_marks, feedback: result.feedback })
    }

    // ── submit answer (within attempt) ────────────────────────────────────────
    const attempt = await getAttempt(id, user.id)
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

    const questions = await getExamQuestions(attempt.exam_format_id)
    const question = questions.find((q) => q.id === questionId)
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

    await upsertAnswer(id, questionId, answerText ?? null, hintsUsed ?? 0)

    const isMcq = question.section_question_type === 'mcq'
    const isPractice = attempt.mode === 'practice'

    if (isPractice || isMcq) {
      const result = await markAnswer({
        questionText: question.question_text,
        questionType: question.section_question_type,
        dataset: question.dataset,
        markScheme: question.mark_scheme,
        maxMarks: question.max_marks,
        studentAnswer: isMcq
          ? (question.options?.[selectedOptionIndex ?? -1] ?? answerText ?? '')
          : (answerText ?? ''),
        correctOptionIndex: question.correct_option_index,
        selectedOptionIndex,
      })

      await markAnswerDb(id, questionId, result.score, result.feedback)
      return NextResponse.json({ score: result.score, maxMarks: question.max_marks, feedback: result.feedback })
    }

    return NextResponse.json({ saved: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
