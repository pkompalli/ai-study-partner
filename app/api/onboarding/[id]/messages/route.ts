import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  getOnboardingSession,
  getOnboardingMessages,
  saveOnboardingMessage,
  updateOnboardingSession,
} from '@/lib/db/onboarding'
import { createCourse } from '@/lib/db/courses'
import { createExamFormat } from '@/lib/db/examBank'
import { inferExamFormat } from '@/lib/llm/examQuestionGenerator'
import { generateStructure, extractCourseName } from '@/lib/llm/onboardingAgent'
import { computeCorrectLayer, getDefaultCheckpointForLayer } from '@/lib/llm/onboardingPrompts'
import type { CollectedData } from '@/types/onboarding'

// POST /api/onboarding/[id]/messages — send message, get streaming response
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as {
      content: string
      checkpointData?: Record<string, unknown>
    }

    if (!body.content) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }

    const session = await getOnboardingSession(id, user.id)
    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Onboarding session is not active' }, { status: 400 })
    }

    // Save user message
    const userContent = body.checkpointData
      ? JSON.stringify({ text: body.content, data: body.checkpointData })
      : body.content
    await saveOnboardingMessage(id, 'user', userContent)

    // Merge checkpoint data into collected data
    let collectedData = (session.collected_data ?? {}) as CollectedData
    if (body.checkpointData) {
      collectedData = { ...collectedData, ...body.checkpointData }
      await updateOnboardingSession(id, { collected_data: collectedData })
    }

    // Handle structure confirmation → create course
    if (body.checkpointData?.structure_confirm === true && collectedData.structure && !collectedData.courseId) {
      try {
        const courseId = await createCourseFromData(user.id, collectedData)
        collectedData.courseId = courseId
        await updateOnboardingSession(id, { collected_data: collectedData, course_id: courseId })
      } catch (err) {
        console.error('[onboarding] failed to create course at structure confirm:', err instanceof Error ? err.message : err)
      }
    }

    // Handle structure REJECTION → clear structure, ask for adjustments
    if (body.checkpointData?.structure_confirm === false) {
      delete collectedData.structure
      await updateOnboardingSession(id, { collected_data: collectedData })
      return emitSimpleResponse(id, session.current_layer, collectedData,
        "No problem! What would you like to change? You can describe how you'd like the course structured, or I can try again.",
        { id: 'structureAdjustment', prompt: 'Describe your preferred structure, or say "try again"', inputType: 'text' },
      )
    }

    // Handle exam format confirmation → save format
    if (body.checkpointData?.exam_format_confirm === true && collectedData.inferredExamFormat && collectedData.courseId) {
      try {
        await createExamFormat(user.id, collectedData.courseId, {
          name: collectedData.inferredExamFormat.name,
          description: collectedData.inferredExamFormat.description,
          total_marks: collectedData.inferredExamFormat.total_marks,
          time_minutes: collectedData.inferredExamFormat.time_minutes,
          instructions: collectedData.inferredExamFormat.instructions,
          sections: collectedData.inferredExamFormat.sections,
        })
      } catch (err) {
        console.error('[onboarding] failed to save exam format:', err)
      }
    }

    // Handle exam format REJECTION → clear format, ask for adjustments
    if (body.checkpointData?.exam_format_confirm === false) {
      delete collectedData.inferredExamFormat
      await updateOnboardingSession(id, { collected_data: collectedData })
      return emitSimpleResponse(id, session.current_layer, collectedData,
        "Got it — what would you like to change about the exam format?",
        { id: 'formatAdjustment', prompt: 'Describe your preferred exam format, or say "try again"', inputType: 'text' },
      )
    }

    // Handle exam format SKIP → move to next layer
    if (body.checkpointData?.exam_format_confirm === 'skip') {
      // Just continue past exam format
    }

    const history = await getOnboardingMessages(id)
    const msgLower = body.content.toLowerCase()

    // ── INTERCEPT: structure adjustment text → regenerate with context ──
    if (body.checkpointData?.structureAdjustment && !collectedData.structure) {
      const courseName = extractCourseName(collectedData, history) ?? 'Course'
      const adjustment = String(body.checkpointData.structureAdjustment)
      if (adjustment.toLowerCase().includes('try again')) {
        return handleStructureGeneration(id, user.id, courseName, collectedData, session.current_layer)
      }
      return handleStructureGeneration(id, user.id, courseName, collectedData, session.current_layer, adjustment)
    }

    // ── INTERCEPT: "Figure it out for me" → generate structure deterministically ──
    const wantStructure = !collectedData.structure
      && (msgLower.includes('figure it out') || msgLower.includes('figure out'))
      && !msgLower.includes('format')
    if (wantStructure) {
      const courseName = extractCourseName(collectedData, history)
      if (courseName) {
        return handleStructureGeneration(id, user.id, courseName, collectedData, session.current_layer)
      }
    }

    // ── INTERCEPT: "Figure out the format" → infer exam format deterministically ──
    const wantFormat = collectedData.structure && !collectedData.inferredExamFormat
      && ((msgLower.includes('figure') && msgLower.includes('format'))
        || (msgLower.includes('figure it out') && collectedData.structure))
    if (wantFormat) {
      const courseName = extractCourseName(collectedData, history) ?? collectedData.structure?.name ?? 'Exam'
      return handleExamFormatInference(id, user.id, courseName, collectedData, session.current_layer)
    }

    // ── Deterministic flow: compute next layer + acknowledgment + checkpoint ──
    const currentLayer = session.current_layer
    const nextLayer = computeCorrectLayer(currentLayer, collectedData)
    const ack = getAcknowledgment(currentLayer, nextLayer, body.content, collectedData)
    const checkpoint = getDefaultCheckpointForLayer(nextLayer, collectedData)

    // Handle finalize (layer 7 → 8)
    if (nextLayer >= 7 && currentLayer < 7 || currentLayer === 7) {
      return handleFinalize(id, user.id, collectedData, nextLayer, history)
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const emit = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

        try {
          // Notify client of course creation
          if (collectedData.courseId) {
            emit({ type: 'course_created', courseId: collectedData.courseId })
          }

          // Emit acknowledgment text
          if (ack) {
            emit({ type: 'chunk', content: ack })
          }

          // Emit layer advance if changed
          if (nextLayer > currentLayer) {
            emit({ type: 'layer_advance', layer: nextLayer })
          }

          // Emit checkpoint
          if (checkpoint) {
            emit({ type: 'checkpoint', checkpoint })
          }

          // Save + update
          await saveOnboardingMessage(id, 'assistant', ack || '')
          await updateOnboardingSession(id, {
            current_layer: nextLayer,
            collected_data: collectedData,
          })

          emit({ type: 'done' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Emit a simple response with a message and checkpoint — no layer change.
 */
function emitSimpleResponse(
  sessionId: string,
  currentLayer: number,
  collectedData: CollectedData,
  message: string,
  checkpoint: { id: string; prompt: string; inputType: string; options?: string[] },
) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const emit = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      try {
        emit({ type: 'chunk', content: message })
        emit({ type: 'checkpoint', checkpoint })
        await saveOnboardingMessage(sessionId, 'assistant', message)
        await updateOnboardingSession(sessionId, { current_layer: currentLayer, collected_data: collectedData })
        emit({ type: 'done' })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

/**
 * Deterministic acknowledgment text for each layer transition.
 * No LLM needed — just warm, concise canned responses.
 */
function getAcknowledgment(
  currentLayer: number,
  nextLayer: number,
  userMessage: string,
  data: CollectedData,
): string {
  // Initial greeting (first message, layer 1)
  if (currentLayer === 1 && userMessage.toLowerCase().includes('just signed up')) {
    return "Hey! Let's set up your study plan — this will take about 2 minutes."
  }

  // Layer 1 → 2: motivation answered
  if (currentLayer === 1 && nextLayer >= 2) {
    return 'Good to know.'
  }

  // Layer 2: studyType answered, asking for name
  if (currentLayer === 2 && nextLayer === 2 && data.studyType && !data.courseName && !data.examName && !data.learningTopic) {
    return ''
  }

  // Layer 2 → 3: name provided
  if (currentLayer === 2 && nextLayer >= 3) {
    return ''
  }

  // Layer 3 → 4: timing answered
  if (currentLayer === 3 && nextLayer >= 4) {
    return "Got it. Let's set up your course materials."
  }

  // Layer 4: structure confirmed, now asking about exam format
  if (currentLayer === 4 && data.structure && data.structure_confirm !== false && !data.examFormatSource) {
    return 'Course structure is ready. Want me to figure out the exam format too?'
  }

  // Layer 4 → 5: exam format decision made (skip/confirmed)
  if (currentLayer === 4 && nextLayer >= 5) {
    const efs = String(data.examFormatSource ?? '').toLowerCase()
    if (efs.includes('skip')) return 'No problem, you can add that later.'
    return ''
  }

  // Layer 5 → 6: exam dates
  if (currentLayer === 5 && nextLayer >= 6) {
    return 'Got it. A few quick questions about your study schedule.'
  }

  // Layer 6: sub-steps within study rhythm
  if (currentLayer === 6 && nextLayer === 6) {
    if (data.sessionsPerWeek && !data.minutesPerSession) {
      return `${data.sessionsPerWeek} days a week — noted.`
    }
    if (data.minutesPerSession) {
      return ''
    }
  }

  // Layer 6 → 7: all study rhythm collected
  if (currentLayer === 6 && nextLayer >= 7) {
    return ''
  }

  return ''
}

/**
 * Handle finalize: create course if needed, wrap up.
 */
function handleFinalize(
  sessionId: string,
  userId: string,
  collectedData: CollectedData,
  nextLayer: number,
  history: { role: string; content: string }[],
) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const emit = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        let finalData = { ...collectedData }

        // Create course if not yet created
        if (!finalData.courseId) {
          const name = extractCourseName(finalData, history as never) ?? 'My Course'
          finalData.courseName = finalData.courseName ?? name
          console.log('[onboarding] finalize: creating course with name:', name, 'structure:', !!finalData.structure)
          try {
            const courseId = await createCourseFromData(userId, finalData)
            finalData.courseId = courseId
            console.log('[onboarding] finalize: course created:', courseId)
            emit({ type: 'tool_result', tool: 'finalize', result: { courseId } })
            emit({ type: 'course_created', courseId })
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error('[onboarding] finalize course creation error:', errMsg, 'data:', JSON.stringify({ courseName: finalData.courseName, studyType: finalData.studyType, hasStructure: !!finalData.structure }))
            emit({ type: 'chunk', content: `Sorry, there was an error creating your course: ${errMsg}` })
            emit({ type: 'done' })
            return
          }
        } else {
          emit({ type: 'course_created', courseId: finalData.courseId })
        }

        // Save exam dates
        try {
          await addExamDates(userId, finalData)
        } catch (err) {
          console.error('[onboarding] addExamDates error:', err)
        }

        const ack = "You're all set! Your course is ready. Redirecting you now..."
        emit({ type: 'chunk', content: ack })
        emit({ type: 'layer_advance', layer: 8 })

        await saveOnboardingMessage(sessionId, 'assistant', ack)
        await updateOnboardingSession(sessionId, {
          current_layer: 8,
          collected_data: finalData,
          status: 'completed',
          course_id: finalData.courseId,
        })

        emit({ type: 'done' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

/**
 * Deterministic structure generation — uses LLM only for the structure itself.
 */
function handleStructureGeneration(
  sessionId: string,
  userId: string,
  courseName: string,
  collectedData: CollectedData,
  currentLayer: number,
  adjustmentDescription?: string,
) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const emit = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const msg = adjustmentDescription
          ? `Got it — let me regenerate the structure with your changes...`
          : `Let me build out the ${courseName} course structure for you...`
        emit({ type: 'chunk', content: msg })
        emit({ type: 'tool_call', tool: 'generate_structure', message: 'Generating course structure...' })

        const structure = await generateStructure(
          courseName,
          collectedData.studyType ?? 'college',
          adjustmentDescription,
        )

        const updatedData = { ...collectedData, structure }
        emit({ type: 'tool_result', tool: 'generate_structure', result: structure })
        emit({
          type: 'checkpoint',
          checkpoint: {
            id: 'structure_confirm',
            prompt: 'Review your course structure',
            inputType: 'structure_preview',
            structure,
          },
        })

        await saveOnboardingMessage(sessionId, 'assistant', msg)
        await updateOnboardingSession(sessionId, {
          current_layer: Math.max(currentLayer, 4),
          collected_data: updatedData,
        })

        emit({ type: 'done' })
      } catch (err) {
        console.error('[onboarding] structure generation failed:', err)
        emit({ type: 'chunk', content: 'Sorry, I had trouble generating the structure. Could you try describing your course in more detail?' })
        const msg = 'Sorry, I had trouble generating the structure. Could you try describing your course in more detail?'
        await saveOnboardingMessage(sessionId, 'assistant', msg)
        emit({ type: 'done' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

/**
 * Deterministic exam format inference — uses LLM only for the inference itself.
 */
function handleExamFormatInference(
  sessionId: string,
  userId: string,
  courseName: string,
  collectedData: CollectedData,
  currentLayer: number,
) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const emit = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        emit({ type: 'chunk', content: `Looking up the exam format for ${courseName}...` })
        emit({ type: 'tool_call', tool: 'infer_exam_format', message: 'Discovering exam format...' })

        const format = await inferExamFormat(courseName, collectedData.structure?.name ?? courseName)

        const updatedData = { ...collectedData, inferredExamFormat: format }
        emit({ type: 'tool_result', tool: 'infer_exam_format', result: format })
        emit({
          type: 'checkpoint',
          checkpoint: {
            id: 'exam_format_confirm',
            prompt: 'Review your exam format',
            inputType: 'exam_format_preview',
            examFormat: format,
          },
        })

        const assistantContent = `Looking up the exam format for ${courseName}...`
        await saveOnboardingMessage(sessionId, 'assistant', assistantContent)
        await updateOnboardingSession(sessionId, {
          current_layer: Math.max(currentLayer, 4),
          collected_data: updatedData,
        })

        emit({ type: 'done' })
      } catch (err) {
        console.error('[onboarding] exam format inference failed:', err)
        emit({ type: 'chunk', content: 'I couldn\'t find the exam format automatically. Let\'s skip this for now — you can set it up later.' })
        const msg = 'I couldn\'t find the exam format automatically. Let\'s skip this for now — you can set it up later.'
        await saveOnboardingMessage(sessionId, 'assistant', msg)
        emit({ type: 'done' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

/**
 * Creates a course and materializes the subject→topic→chapter hierarchy
 */
async function createCourseFromData(userId: string, data: CollectedData): Promise<string> {
  const st = String(data.studyType ?? '').toLowerCase()
  const goal = data.goal ?? (st.includes('competitive') ? 'exam_prep' : 'classwork')
  const courseName = data.structure?.name ?? data.courseName ?? data.examName ?? data.learningTopic ?? 'My Course'

  // Map source type to valid DB values ('text', 'pdf', 'image', 'json')
  const validSourceTypes = ['text', 'pdf', 'image', 'json']
  const sourceType = validSourceTypes.includes(data.sourceType ?? '') ? data.sourceType : 'text'

  const course = await createCourse(userId, {
    name: courseName,
    description: data.structure?.description ?? `Course for ${courseName}`,
    goal,
    exam_name: data.examName,
    year_of_study: data.yearOfStudy,
    source_type: sourceType,
    structure: data.structure ? { subjects: data.structure.subjects } : undefined,
  })

  // Materialize into relational tables
  const subjects = data.structure?.subjects ?? []
  if (subjects.length > 0) {
    const svc = await createServiceClient()
    for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
      const subj = subjects[sIdx]
      const { data: subjRow, error: subjErr } = await svc
        .from('subjects')
        .insert({ course_id: course.id, name: subj.name, sort_order: sIdx })
        .select()
        .single()
      if (subjErr || !subjRow) continue
      for (let tIdx = 0; tIdx < (subj.topics ?? []).length; tIdx++) {
        const topic = subj.topics![tIdx]
        const { data: topicRow, error: topicErr } = await svc
          .from('topics')
          .insert({ subject_id: subjRow.id, course_id: course.id, name: topic.name, sort_order: tIdx })
          .select()
          .single()
        if (topicErr || !topicRow) continue
        for (let cIdx = 0; cIdx < (topic.chapters ?? []).length; cIdx++) {
          const chapter = topic.chapters![cIdx]
          await svc
            .from('chapters')
            .insert({ topic_id: topicRow.id, course_id: course.id, name: chapter.name, sort_order: cIdx })
        }
      }
    }
  }

  return course.id
}

/**
 * Adds exam dates to the course
 */
async function addExamDates(userId: string, data: CollectedData): Promise<void> {
  if (!data.examDates || data.examDates.length === 0 || !data.courseId) return
  const svc = await createServiceClient()
  for (const ed of data.examDates) {
    await svc.from('exam_dates').insert({
      user_id: userId,
      course_id: data.courseId,
      label: ed.label,
      exam_date: ed.date,
      notes: ed.notes ?? null,
      chapter_ids: ed.chapterIds ?? [],
    })
  }
}
