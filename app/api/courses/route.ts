import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getCoursesByUser,
  createCourse,
} from '@/lib/db/courses'
import {
  extractCourseFromText,
  extractCourseFromPDF,
  extractCourseFromImages,
  extractCourseFromJSON,
} from '@/lib/llm/courseExtractor'
import { uploadFile } from '@/lib/storage'

// GET /api/courses — list all courses for the authenticated user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const courses = await getCoursesByUser(user.id)
    return NextResponse.json(courses)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/courses — create a new course
// Also handles POST /api/courses with body { action: 'extract' } for course extraction
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const contentType = req.headers.get('content-type') ?? ''

    // Handle multipart/form-data (course extraction with file upload)
    if (contentType.includes('multipart/form-data')) {
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
    }

    // Regular JSON body — create a course
    const body = await req.json() as {
      name: string
      description?: string
      goal: 'exam_prep' | 'classwork'
      examName?: string
      yearOfStudy?: string
      sourceType?: string
      sourceFileUrl?: string
      rawInput?: string
      structure?: unknown
    }

    const course = await createCourse(user.id, {
      name: body.name,
      description: body.description,
      goal: body.goal,
      exam_name: body.examName,
      year_of_study: body.yearOfStudy,
      source_type: body.sourceType,
      source_file_url: body.sourceFileUrl,
      raw_input: body.rawInput,
      structure: body.structure,
    })

    return NextResponse.json({ id: course.id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
