import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCourseContext } from '@/lib/db/courses'
import { analyzeHomework, extractHomeworkPdfText } from '@/lib/llm/homeworkGenerator'
import { checkRateLimit } from '@/lib/server/rateLimit'
import { validateUploadedFiles } from '@/lib/server/uploadValidation'

export const runtime = 'nodejs'

// POST /api/homework/feedback — analyze uploaded homework and provide feedback
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = checkRateLimit(`homework-feedback:${user.id}`, { limit: 10, windowMs: 60_000 })
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const formData = await req.formData()
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)
    const courseId = formData.get('courseId') as string | null
    const topicName = formData.get('topicName') as string | null
    const chapterName = formData.get('chapterName') as string | null

    if (!courseId) {
      return NextResponse.json({ error: 'courseId required' }, { status: 400 })
    }

    if (!files.length) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    const uploadError = validateUploadedFiles(files, {
      maxFiles: 20,
      maxFileSizeBytes: 25 * 1024 * 1024,
      allowedTypes: ['application/pdf', 'image/*'],
    })
    if (uploadError) return NextResponse.json({ error: uploadError }, { status: 400 })

    const ctx = await getCourseContext(courseId)
    const courseName = ctx?.name ?? 'Course'

    // Process files
    const imageFiles: Array<{ base64: string; mimeType: string }> = []
    const pdfTexts: string[] = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      if (file.type === 'application/pdf') {
        const text = await extractHomeworkPdfText(buffer)
        if (text.trim()) pdfTexts.push(text)
      } else if (file.type.startsWith('image/')) {
        imageFiles.push({ base64: buffer.toString('base64'), mimeType: file.type })
      }
    }

    if (!imageFiles.length && !pdfTexts.length) {
      return NextResponse.json({ error: 'Could not extract content from uploaded files' }, { status: 400 })
    }

    const feedback = await analyzeHomework({
      files: imageFiles,
      pdfTexts,
      courseName,
      topicName: topicName ?? undefined,
      chapterName: chapterName ?? undefined,
    })

    return NextResponse.json(feedback)
  } catch (err: unknown) {
    console.error('[homework-feedback] ERROR:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
