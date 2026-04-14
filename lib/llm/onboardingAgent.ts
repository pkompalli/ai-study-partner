import type { ChatCompletionMessageParam } from '@/lib/llm/client'
import { chatCompletionStream, chatCompletion } from '@/lib/llm/client'
import { buildOnboardingSystemPrompt } from '@/lib/llm/onboardingPrompts'
import type { OnboardingMessage, OnboardingEvent, CollectedData, CheckpointDef } from '@/types/onboarding'

/**
 * Streams onboarding agent responses, yielding events for the SSE stream.
 * Keeps it simple: stream LLM text, parse any structured blocks it emits.
 * Heavy lifting (structure generation, exam format inference) is handled by the route handler.
 */
export async function* streamOnboardingResponse(
  userMessage: string,
  history: OnboardingMessage[],
  collectedData: CollectedData,
  currentLayer: number,
): AsyncGenerator<OnboardingEvent, { assistantContent: string; collectedData: CollectedData; nextLayer: number; toolCalls: Array<{ tool: string; args: Record<string, unknown> }> }, unknown> {
  const systemPrompt = buildOnboardingSystemPrompt(currentLayer, collectedData)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ]

  // Add conversation history (last 20 messages)
  const recent = history.slice(-20)
  for (const msg of recent) {
    if (msg.role === 'system') continue
    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
  }
  messages.push({ role: 'user', content: userMessage })

  let fullContent = ''
  for await (const chunk of chatCompletionStream(messages, { temperature: 0.7, maxTokens: 2048 })) {
    fullContent += chunk
    yield { type: 'chunk', content: chunk }
  }

  // Parse structured blocks from the response
  const { checkpoint, toolCall, nextLayer } = parseAgentOutput(fullContent)

  let newLayer = currentLayer
  if (nextLayer !== null) {
    newLayer = nextLayer
    yield { type: 'layer_advance', layer: nextLayer }
  }

  if (checkpoint) {
    yield { type: 'checkpoint', checkpoint }
  }

  const updatedData = { ...collectedData }
  const toolCalls: Array<{ tool: string; args: Record<string, unknown> }> = []

  if (toolCall) {
    toolCalls.push(toolCall)
  }

  return { assistantContent: fullContent, collectedData: updatedData, nextLayer: newLayer, toolCalls }
}

/**
 * Generate a course structure from a course/exam name.
 * Called by the route handler, NOT by the agent.
 */
export async function generateStructure(
  courseName: string,
  studyType: string,
  description?: string,
): Promise<NonNullable<CollectedData['structure']>> {
  const prompt = `Generate a detailed course structure for: "${courseName}"
Study type: ${studyType}
${description ? `Additional context: ${description}` : ''}

Return a JSON object with this exact structure:
{
  "name": "Course Name",
  "description": "Brief description",
  "subjects": [
    {
      "name": "Subject/Unit Name",
      "topics": [
        {
          "name": "Topic Name",
          "chapters": [
            { "name": "Chapter Name" }
          ]
        }
      ]
    }
  ]
}

Create a realistic, comprehensive structure with 2-5 subjects, each with 2-6 topics, each with 2-4 chapters.
Use real academic content appropriate for the course.`

  const response = await chatCompletion([
    { role: 'system', content: prompt },
    { role: 'user', content: 'Generate the structure now.' },
  ], { temperature: 0.3, maxTokens: 4096 })

  const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  return JSON.parse(cleaned) as NonNullable<CollectedData['structure']>
}

/**
 * Extracts the course/exam name from collected data.
 * Checkpoint IDs are LLM-generated and unpredictable, so we scan all string values.
 */
export function extractCourseName(
  data: CollectedData,
  history: OnboardingMessage[],
): string | null {
  // 1) Check known CollectedData keys
  if (data.courseName) return data.courseName
  if (data.examName) return data.examName
  if (data.learningTopic) return data.learningTopic
  if (data.structure?.name) return data.structure.name

  // 2) Scan all string values — skip known enum/UI values
  const skipValues = new Set([
    // Enum values from CollectedData
    'catch_up', 'crunch', 'stay_on_top', 'exploring', 'big_exam',
    'college', 'competitive', 'self_paced',
    'just_starting', 'mid_semester', 'final_stretch', 'between_semesters',
    'text', 'pdf', 'image', 'web_search', 'manual',
    'exam_prep', 'classwork',
    'morning', 'afternoon', 'evening', 'night',
    // Common pill labels (lowercase)
    'i\'m behind', 'exams coming up', 'better grades', 'can\'t organize',
    'big exam prep', 'just exploring', 'college course', 'competitive exam',
    'self-paced learning', 'i\'ll upload my syllabus', 'i\'ll paste/type it',
    'figure it out for me', '30 min', '45 min', '60 min', '90 min',
    'looks good!', 'let me adjust', 'skip', 'continue',
  ])

  for (const [, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.length > 2 && value.length < 100
        && !skipValues.has(value.toLowerCase())) {
      return value
    }
  }

  // 3) Scan user messages — the exam/course name is usually a short answer
  const userMsgs = history
    .filter(m => m.role === 'user')
    .slice(-8)
    .map(m => {
      try { return (JSON.parse(m.content) as { text?: string }).text ?? m.content } catch { return m.content }
    })

  for (const msg of userMsgs) {
    if (typeof msg === 'string' && msg.length > 2 && msg.length < 80
        && !skipValues.has(msg.toLowerCase())
        && !msg.toLowerCase().startsWith('hi,')
        && !msg.toLowerCase().includes('figure it out')
        && !msg.toLowerCase().includes('just starting')
        && !msg.toLowerCase().includes('start over')) {
      return msg
    }
  }

  return null
}

interface ParsedOutput {
  textContent: string
  checkpoint: CheckpointDef | null
  toolCall: { tool: string; args: Record<string, unknown> } | null
  nextLayer: number | null
}

function parseAgentOutput(content: string): ParsedOutput {
  let textContent = content
  let checkpoint: CheckpointDef | null = null
  let toolCall: { tool: string; args: Record<string, unknown> } | null = null
  let nextLayer: number | null = null

  const checkpointMatch = content.match(/```checkpoint\s*\n([\s\S]*?)\n```/)
  if (checkpointMatch) {
    try {
      checkpoint = JSON.parse(checkpointMatch[1]) as CheckpointDef
      textContent = textContent.replace(checkpointMatch[0], '').trim()
    } catch { /* ignore */ }
  }

  const toolCallMatch = content.match(/```tool_call\s*\n([\s\S]*?)\n```/)
  if (toolCallMatch) {
    try {
      toolCall = JSON.parse(toolCallMatch[1]) as { tool: string; args: Record<string, unknown> }
      textContent = textContent.replace(toolCallMatch[0], '').trim()
    } catch { /* ignore */ }
  }

  const layerMatch = content.match(/```layer_advance\s*\n([\s\S]*?)\n```/)
  if (layerMatch) {
    try {
      const parsed = JSON.parse(layerMatch[1]) as { layer: number }
      nextLayer = parsed.layer
      textContent = textContent.replace(layerMatch[0], '').trim()
    } catch { /* ignore */ }
  }

  return { textContent, checkpoint, toolCall, nextLayer }
}
