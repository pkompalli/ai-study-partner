import type { CollectedData, CheckpointDef } from '@/types/onboarding'

/**
 * Deterministically compute the correct layer based on collected data.
 * The LLM is unreliable at emitting layer_advance, so the route handler
 * uses this to force the correct layer after each turn.
 */
export function computeCorrectLayer(
  currentLayer: number,
  collectedData: CollectedData,
): number {
  // Layer 1 → 2: motivation answered
  if (currentLayer === 1 && collectedData.motivationSignal) return 2
  // Layer 2: two phases — first studyType, then course/exam name
  if (currentLayer === 2) {
    if (!collectedData.studyType) return 2
    // studyType set but no name yet → stay on 2
    if (!collectedData.courseName && !collectedData.examName && !collectedData.learningTopic) return 2
    // both set → advance to 3
    return 3
  }
  // Layer 3: structure + exam format
  if (currentLayer === 3) {
    // No structure yet → stay on 3 (route handler handles structure gen intercept)
    if (!collectedData.structure) return 3
    // Structure exists but no exam format decision yet → stay on 3 (show exam format pills)
    const efs = collectedData.examFormatSource as string | undefined
    if (!efs) return 3
    // Exam format decision made → advance to 4
    return 4
  }
  // Layer 4 → 5: exam dates answered (or skipped)
  if (currentLayer === 4 && collectedData.examDates !== undefined) return 5
  // Layer 5: three phases — sessions/week, then hours/session, then preferred times
  if (currentLayer === 5) {
    if (!collectedData.sessionsPerWeek) return 5
    if (!collectedData.minutesPerSession) return 5
    if (!collectedData.preferredTimes || collectedData.preferredTimes.length === 0) return 5
    return 6
  }
  return currentLayer
}

/**
 * Returns the default checkpoint for a given layer + collected data.
 * Used by the route handler as a fallback when the LLM advances layers
 * but doesn't emit the next checkpoint.
 */
export function getDefaultCheckpointForLayer(
  layer: number,
  collectedData: CollectedData,
): CheckpointDef | null {
  switch (layer) {
    case 1:
      return {
        id: 'motivationSignal',
        prompt: 'What brings you here?',
        inputType: 'pills',
        options: ["I'm behind", 'Exams coming up', 'Better grades', "Can't organize", 'Big exam prep', 'Just exploring'],
      }
    case 2: {
      if (!collectedData.studyType) {
        return {
          id: 'studyType',
          prompt: 'What type of studying?',
          inputType: 'pills',
          options: ['College course', 'Competitive exam', 'Self-paced learning'],
        }
      }
      // Phase 2 of layer 2: ask for specific name
      const st = String(collectedData.studyType).toLowerCase()
      if (st.includes('college')) {
        return { id: 'courseName', prompt: 'What course are you taking?', inputType: 'text' }
      }
      if (st.includes('competitive')) {
        return { id: 'examName', prompt: 'Which exam are you preparing for?', inputType: 'text' }
      }
      return { id: 'learningTopic', prompt: 'What do you want to learn?', inputType: 'text' }
    }
    case 3:
      if (collectedData.structure) {
        return {
          id: 'examFormatSource',
          prompt: 'Should I figure out the exam format for you?',
          inputType: 'pills',
          options: ['Figure out the format for me', "I'll upload a sample paper", 'Skip for now'],
        }
      }
      return {
        id: 'sourceType',
        prompt: 'How should we set up your course structure?',
        inputType: 'pills',
        options: ["I'll upload my syllabus", "I'll paste/type it", 'Figure it out for me'],
      }
    case 4:
      return {
        id: 'examDates',
        prompt: 'When are your exams? Add dates below.',
        inputType: 'date_picker',
      }
    case 5: {
      if (!collectedData.sessionsPerWeek) {
        return {
          id: 'sessionsPerWeek',
          prompt: 'How many days a week can you study?',
          inputType: 'number_slider',
          min: 2,
          max: 7,
          step: 1,
          defaultValue: 4,
        }
      }
      if (!collectedData.minutesPerSession) {
        return {
          id: 'minutesPerSession',
          prompt: 'How long is a typical study session for you?',
          inputType: 'pills',
          options: ['30 min', '45 min', '1 hour', '1.5 hours', '2+ hours'],
        }
      }
      return {
        id: 'preferredTimes',
        prompt: 'When do you prefer to study?',
        inputType: 'multi_pills',
        options: ['Morning', 'Afternoon', 'Evening', 'Night'],
      }
    }
    default:
      return null
  }
}

export function buildOnboardingSystemPrompt(
  currentLayer: number,
  collectedData: CollectedData,
): string {
  const collected = JSON.stringify(collectedData, null, 2)

  return `You are an onboarding agent for StudyMate by OnCourse — an AI study companion.
Your job is to have a sharp, warm conversation to set up a new student.
You're like a sharp friend — direct, encouraging, no fluff.

## Current State
Current layer: ${currentLayer}
Data collected so far:
${collected}

## CRITICAL RULES

1. NEVER skip layers. Process one layer at a time.
2. Each response = 1-2 sentences of conversational text + structured blocks (checkpoint, layer_advance).
3. When a student ANSWERS a layer's question: acknowledge briefly, emit layer_advance, AND emit the NEXT layer's checkpoint so they can immediately continue.
4. When a student has NOT yet answered: just emit the current layer's checkpoint.
5. ALWAYS emit a checkpoint block. The user CANNOT proceed without one.

## Layer Instructions

${getLayerInstructions(currentLayer, collectedData)}

## Output Format

Your response MUST be:
1. One or two sentences of conversational text
2. If advancing: a layer_advance block + the NEXT layer's checkpoint block
3. If NOT advancing: a checkpoint block for the current layer
4. (Or a tool_call block if specified in the layer instructions)

Checkpoint format:
\`\`\`checkpoint
{"id":"...","prompt":"...","inputType":"pills","options":["..."]}
\`\`\`

Tool call format:
\`\`\`tool_call
{"tool":"finalize","args":{"goal":"exam_prep"}}
\`\`\`

Layer advance (include when moving to next layer):
\`\`\`layer_advance
{"layer": <number>}
\`\`\`

REMINDER: Only handle layer ${currentLayer}. Do NOT ask about anything from later layers.`
}

function getLayerInstructions(layer: number, data: CollectedData): string {
  switch (layer) {
    case 1:
      return `### Layer 1: Why are you here?
Ask what brings them to StudyMate. Respond warmly to their answer, then emit this checkpoint:

\`\`\`checkpoint
{"id":"motivationSignal","prompt":"What brings you here?","inputType":"pills","options":["I'm behind","Exams coming up","Better grades","Can't organize","Big exam prep","Just exploring"]}
\`\`\`

When the student answers, acknowledge with 1 sentence, then emit BOTH a layer_advance AND the Layer 2 checkpoint:

\`\`\`layer_advance
{"layer": 2}
\`\`\`

\`\`\`checkpoint
{"id":"studyType","prompt":"What type of studying?","inputType":"pills","options":["College course","Competitive exam","Self-paced learning"]}
\`\`\``

    case 2:
      if (!data.studyType) {
        return `### Layer 2: What are you studying?
Ask what type of studying they're doing. Emit this checkpoint:

\`\`\`checkpoint
{"id":"studyType","prompt":"What type of studying?","inputType":"pills","options":["College course","Competitive exam","Self-paced learning"]}
\`\`\`

When they answer, acknowledge with 1 sentence AND immediately emit the next checkpoint to ask for the specific course/exam name. Do NOT emit layer_advance yet — stay on layer 2.

- If "College course": emit checkpoint {"id":"courseName","prompt":"What course are you taking?","inputType":"text"}
- If "Competitive exam": emit checkpoint {"id":"examName","prompt":"Which exam are you preparing for?","inputType":"text"}
- If "Self-paced learning": emit checkpoint {"id":"learningTopic","prompt":"What do you want to learn?","inputType":"text"}`
      }
      return `### Layer 2: Get the specific course/exam name
The student selected: ${data.studyType}
Now ask for the specific name. Use the appropriate checkpoint:

- If "College course" or "college": {"id":"courseName","prompt":"What course are you taking?","inputType":"text"}
- If "Competitive exam" or "competitive": {"id":"examName","prompt":"Which exam are you preparing for?","inputType":"text"}
- If "Self-paced learning" or "self_paced": {"id":"learningTopic","prompt":"What do you want to learn?","inputType":"text"}

IMPORTANT: Use these EXACT checkpoint IDs. When they answer, acknowledge briefly, then emit layer_advance to layer 3 AND the Layer 3 checkpoint:

\`\`\`checkpoint
{"id":"sourceType","prompt":"How should we set up your course structure?","inputType":"pills","options":["I'll upload my syllabus","I'll paste/type it","Figure it out for me"]}
\`\`\``

    case 3:
      if (data.structure) {
        // Structure already exists, move to 3b (exam format)
        return `### Layer 3b: Exam Format
The course structure is already set up. Now ask about exam format:

\`\`\`checkpoint
{"id":"examFormatSource","prompt":"Should I figure out the exam format for you?","inputType":"pills","options":["Figure out the format for me","I'll upload a sample paper","Skip for now"]}
\`\`\`

When they answer, acknowledge briefly, then emit layer_advance to layer 4 AND the Layer 4 checkpoint:

\`\`\`checkpoint
{"id":"examDates","prompt":"When are your exams? Add dates below.","inputType":"date_picker"}
\`\`\``
      }
      return `### Layer 3: Course Structure
Ask how they want to set up the course structure:

\`\`\`checkpoint
{"id":"sourceType","prompt":"How should we set up your course structure?","inputType":"pills","options":["I'll upload my syllabus","I'll paste/type it","Figure it out for me"]}
\`\`\`

If the student picks "Figure it out for me", the system will handle structure generation automatically. Just acknowledge and wait.
When structure is confirmed (structure_confirm = true in collected data), the course is created. Stay on layer 3 — the system will handle moving to exam format.`

    case 4:
      return `### Layer 4: Exam Dates
Ask about upcoming exams/deadlines:

\`\`\`checkpoint
{"id":"examDates","prompt":"When are your exams? Add dates below.","inputType":"date_picker"}
\`\`\`

When they answer (or skip), acknowledge briefly, then emit layer_advance to layer 5 AND the Layer 5 checkpoint:

\`\`\`checkpoint
{"id":"sessionsPerWeek","prompt":"How many days a week can you study?","inputType":"number_slider","min":2,"max":7,"step":1,"defaultValue":4}
\`\`\``

    case 5:
      return `### Layer 5: Study Rhythm
Ask about study habits. Emit this checkpoint:

\`\`\`checkpoint
{"id":"sessionsPerWeek","prompt":"How many days a week can you study?","inputType":"number_slider","min":2,"max":7,"step":1,"defaultValue":4}
\`\`\`

When they answer, acknowledge briefly, then emit layer_advance to layer 6. No checkpoint needed for layer 6 — just the layer_advance.`

    case 6:
      return `### Layer 6: Wrap Up
Summarize what you've set up and emit the finalize tool call:

\`\`\`tool_call
{"tool":"finalize","args":{"goal":"${data.studyType === 'competitive' ? 'exam_prep' : 'classwork'}"}}
\`\`\`

Emit layer_advance to layer 7.`

    case 7:
      return `### Layer 7: Done!
Say something brief and celebratory like "You're all set! Your course is ready." The system will redirect them automatically.`

    default:
      return `Continue the conversation naturally.`
  }
}
