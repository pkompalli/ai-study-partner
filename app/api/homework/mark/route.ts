import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markHomeworkAnswer } from '@/lib/llm/homeworkGenerator'
import { checkRateLimit } from '@/lib/server/rateLimit'
import { validateUploadedFiles } from '@/lib/server/uploadValidation'

export const runtime = 'nodejs'

// POST /api/homework/mark — mark a homework problem answer
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = checkRateLimit(`homework-mark:${user.id}`, { limit: 30, windowMs: 60_000 })
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const formData = await req.formData()
    const questionText = formData.get('questionText') as string | null
    const answerText = formData.get('answerText') as string | null
    const maxMarks = parseInt(formData.get('maxMarks') as string ?? '4')
    const markSchemeRaw = formData.get('markScheme') as string | null
    const workedSolution = formData.get('workedSolution') as string | null
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)

    if (!questionText) {
      return NextResponse.json({ error: 'questionText required' }, { status: 400 })
    }

    if (!answerText && !files.length) {
      return NextResponse.json({ error: 'Answer text or files required' }, { status: 400 })
    }

    if (files.length) {
      const uploadError = validateUploadedFiles(files, {
        maxFiles: 10,
        maxFileSizeBytes: 20 * 1024 * 1024,
        allowedTypes: ['image/*', 'application/pdf'],
      })
      if (uploadError) return NextResponse.json({ error: uploadError }, { status: 400 })
    }

    let markScheme: Array<{ label: string; description?: string; marks: number }> = []
    if (markSchemeRaw) {
      try { markScheme = JSON.parse(markSchemeRaw) } catch { /* use empty */ }
    }

    // Process image files for vision
    const imageContent: Array<{ base64: string; mimeType: string }> = []
    let pdfText = ''
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      if (file.type.startsWith('image/')) {
        imageContent.push({ base64: buffer.toString('base64'), mimeType: file.type })
      } else if (file.type === 'application/pdf') {
        const { extractHomeworkPdfText } = await import('@/lib/llm/homeworkGenerator')
        const text = await extractHomeworkPdfText(buffer)
        if (text.trim()) pdfText += '\n' + text
      }
    }

    const studentAnswer = ((answerText ?? '') + (pdfText ? `\n\n[Uploaded document content:]\n${pdfText}` : '')).trim()

    const result = await markHomeworkAnswer({
      questionText,
      studentAnswer: studentAnswer || '[See attached images]',
      maxMarks,
      markScheme,
      workedSolution: workedSolution ?? undefined,
      imageContent: imageContent.length ? imageContent : undefined,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[homework-mark] ERROR:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
