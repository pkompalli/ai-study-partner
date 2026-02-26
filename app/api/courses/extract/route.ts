import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  extractCourseFromText,
  extractCourseFromPDF,
  extractCourseFromImages,
  extractCourseFromJSON,
} from '@/lib/llm/courseExtractor'
import { uploadFile } from '@/lib/storage'

// POST /api/courses/extract — extract course structure from uploaded content
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const sourceType = formData.get('sourceType') as string | null
    const rawInput = formData.get('rawInput') as string | undefined ?? undefined

    const singleFile = formData.get('file') as File | null
    const multiFilesRaw = formData.getAll('files') as File[]
    const multiFiles = multiFilesRaw.length > 0 ? multiFilesRaw : (singleFile ? [singleFile] : [])

    let structure
    if (sourceType === 'text' && rawInput) {
      structure = await extractCourseFromText(rawInput)
    } else if (sourceType === 'pdf' && singleFile) {
      const buffer = Buffer.from(await singleFile.arrayBuffer())
      structure = await extractCourseFromPDF(buffer)
    } else if (sourceType === 'image' && multiFiles.length > 0) {
      const images = await Promise.all(
        multiFiles.map(async (f) => ({
          base64: Buffer.from(await f.arrayBuffer()).toString('base64'),
          mimeType: f.type,
        })),
      )
      structure = await extractCourseFromImages(images)
    } else if (sourceType === 'json') {
      const jsonText = rawInput ?? (singleFile ? Buffer.from(await singleFile.arrayBuffer()).toString('utf-8') : null)
      if (!jsonText) return NextResponse.json({ error: 'Missing JSON content' }, { status: 400 })
      structure = await extractCourseFromJSON(jsonText)
    } else {
      return NextResponse.json({ error: 'Invalid source type or missing content' }, { status: 400 })
    }

    let sourceFileUrl: string | undefined
    if (singleFile) {
      const buffer = Buffer.from(await singleFile.arrayBuffer())
      const filePath = `${user.id}/${Date.now()}-${singleFile.name}`
      sourceFileUrl = await uploadFile('course-uploads', filePath, buffer, singleFile.type)
    }

    return NextResponse.json({ structure, sourceFileUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
