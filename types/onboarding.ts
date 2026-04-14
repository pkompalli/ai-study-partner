export interface OnboardingSession {
  id: string
  user_id: string
  status: 'active' | 'completed' | 'abandoned'
  current_layer: number
  collected_data: CollectedData
  course_id: string | null
  created_at: string
  updated_at: string
}

export interface OnboardingMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  content_type: 'text' | 'checkpoint' | 'tool_result'
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface CollectedData {
  // Layer 1: Motivation
  motivation?: string
  motivationSignal?: 'catch_up' | 'crunch' | 'stay_on_top' | 'exploring' | 'big_exam'

  // Layer 2: Study context
  studyType?: 'college' | 'competitive' | 'self_paced'
  courseName?: string
  university?: string
  examName?: string  // for competitive exams
  learningTopic?: string  // for self-paced

  // Layer 3: Timing
  semesterTiming?: 'just_starting' | 'mid_semester' | 'final_stretch' | 'between_semesters' | string
  examTimeline?: string  // for competitive exams
  deadline?: string  // for self-paced
  yearOfStudy?: string

  // Layer 4: Resources / course structure
  sourceType?: 'text' | 'pdf' | 'image' | 'web_search' | 'manual' | string
  structureAdjustment?: string  // user's feedback for structure regeneration
  structure_confirm?: boolean  // whether structure was confirmed
  sourceFileUrl?: string
  structure?: {
    name?: string
    description?: string
    subjects: Array<{
      name: string
      topics?: Array<{
        name: string
        chapters?: Array<{ name: string }>
      }>
    }>
  }

  // Layer 4b: Exam format source decision
  examFormatSource?: string  // "Figure out the format for me" | "I'll upload a sample paper" | "Skip for now"
  // Layer 4b: Exam format (discovered after structure)
  inferredExamFormat?: {
    name: string
    description?: string
    total_marks?: number
    time_minutes?: number
    instructions?: string
    sections: Array<{
      name: string
      question_type: string
      num_questions: number
      marks_per_question?: number
      total_marks?: number
      instructions?: string
      num_options?: number
    }>
  }

  // Layer 5: Exam dates
  examDates?: Array<{
    label: string
    date: string
    notes?: string
    chapterIds?: string[]
  }>

  // Layer 6: Study rhythm
  sessionsPerWeek?: number
  minutesPerSession?: number | string  // e.g. 60 or "1 hour"
  preferredTimes?: string[]  // e.g. ['Morning', 'Evening']
  preferredDays?: string[]

  // Layer 7: Plan
  goal?: 'exam_prep' | 'classwork'

  // Layer 8: Course created
  courseId?: string
}

export type CheckpointInputType =
  | 'pills'
  | 'text'
  | 'file_upload'
  | 'date_picker'
  | 'confirm'
  | 'structure_preview'
  | 'exam_format_preview'
  | 'number_slider'
  | 'multi_pills'

export interface CheckpointDef {
  id: string
  prompt: string
  inputType: CheckpointInputType
  options?: string[]
  min?: number
  max?: number
  step?: number
  defaultValue?: unknown
  structure?: CollectedData['structure']
  examFormat?: CollectedData['inferredExamFormat']
}

export type OnboardingEvent =
  | { type: 'chunk'; content: string }
  | { type: 'checkpoint'; checkpoint: CheckpointDef }
  | { type: 'layer_advance'; layer: number }
  | { type: 'tool_call'; tool: string; message: string }
  | { type: 'tool_result'; tool: string; result: unknown }
  | { type: 'course_created'; courseId: string }
  | { type: 'done' }
