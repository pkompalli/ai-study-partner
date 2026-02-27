import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractExamFromPaper } from '@/lib/llm/examQuestionGenerator'
import { checkRateLimit } from '@/lib/server/rateLimit'
import { validateUploadedFiles } from '@/lib/server/uploadValidation'

// POST /api/exam/formats/extract-paper — extract exam format + questions from uploaded paper
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const limit = checkRateLimit(`exam-paper-extract:${user.id}`, { limit: 10, windowMs: 60_000 })
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many extraction requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const singleFile = formData.get('file') as File | null
    const uploadFiles = singleFile ? [singleFile] : files
    const uploadError = validateUploadedFiles(uploadFiles, {
      maxFiles: 30,
      maxFileSizeBytes: 25 * 1024 * 1024,
      allowedTypes: ['application/pdf', 'image/*'],
    })
    if (uploadError) return NextResponse.json({ error: uploadError }, { status: 400 })

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
