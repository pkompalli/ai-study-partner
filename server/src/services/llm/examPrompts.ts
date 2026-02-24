import type { MarkCriterion } from '../../db/examBank.db.js';

// ─── Paper extraction ──────────────────────────────────────────────────────────

export function buildPaperExtractionPrompt(paperText: string): string {
  return `You are an expert examiner analysing a past exam paper or worksheet. Extract the complete question bank from the text below.

Return ONLY valid JSON — no markdown, no code fences:
{
  "name": "Exam / worksheet title",
  "total_marks": 100,
  "time_minutes": 120,
  "instructions": "General instructions to candidates (if present, else null)",
  "sections": [
    {
      "name": "Section A — Multiple Choice",
      "question_type": "mcq",
      "num_questions": 30,
      "marks_per_question": 1,
      "instructions": "Answer all questions (if present, else null)"
    }
  ],
  "questions": [
    {
      "section_index": 0,
      "question_text": "Full verbatim question text",
      "dataset": null,
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correct_option_index": 2,
      "max_marks": 1,
      "mark_scheme": [{ "label": "Correct answer", "marks": 1 }]
    }
  ],
  "questions_truncated": false
}

Rules for sections:
- question_type must be: mcq, short_answer, long_answer, data_analysis, calculation
- Infer question_type from the section heading and question style
- num_questions = actual count of questions you extracted for that section

Rules for questions:
- Extract questions in order, grouped by section (section_index is 0-based index into sections array)
- question_text: copy verbatim including all sub-parts (a), (b), etc. combined into one text
- dataset: for data_analysis questions, copy the table or scenario text; null for all others
- options: array of 4 strings for MCQ only; null for all other types
- correct_option_index: 0-3 if an answer key is present; null if not
- max_marks: marks shown next to the question (e.g. [3] or (3 marks))
- mark_scheme: generate a plausible mark scheme based on the question if no answer scheme is provided:
  - For MCQ: [{"label": "Correct answer", "marks": 1}]
  - For short/calculation: break marks into logical criteria (method, substitution, answer, units)
  - For long answer: break into assessment objectives (Knowledge, Application, Analysis)
- questions_truncated: set to true if you could not extract ALL questions due to length

Extract every question you can identify. If the paper is very long, extract as many as possible in order.

Paper text:
---
${paperText.slice(0, 20000)}
---`;
}

// ─── Format inference ──────────────────────────────────────────────────────────

export function buildExamFormatInferPrompt(examName: string, courseName: string): string {
  return `You are an educational exam specialist. Generate a realistic exam format based on the exam name and course.

Exam: "${examName}"
Course: "${courseName}"

Return ONLY valid JSON — no markdown, no code fences, no extra text:
{
  "name": "Full exam name",
  "description": "Brief description of the exam format",
  "total_marks": 100,
  "time_minutes": 180,
  "instructions": "General exam instructions for the candidate",
  "sections": [
    {
      "name": "Section A — Multiple Choice",
      "question_type": "mcq",
      "num_questions": 30,
      "marks_per_question": 1,
      "instructions": "Answer ALL questions in this section."
    }
  ]
}

question_type must be one of: mcq, short_answer, long_answer, data_analysis, calculation

Rules:
- Generate 2–4 sections that accurately reflect the real exam structure for "${examName}" if known
- Use realistic mark allocations and timings
- For well-known exams (A-Level, IB, AP, SAT, GRE, GCSE, etc.) use the actual section structure
- If the exam is not widely known, generate a sensible structure based on the subject and level inferred from the course name
- Vary question types appropriately: exams with essays need long_answer; sciences need calculation; sciences/geography need data_analysis`;
}

// ─── Question generation ───────────────────────────────────────────────────────

const QUESTION_TYPE_INSTRUCTIONS: Record<string, string> = {
  mcq: `Generate a multiple-choice question with exactly 4 options. ONE must be correct, THREE must be plausible distractors (common misconceptions, subtly wrong values, reversed causality).
Return JSON fields: question_text, options (array of 4 strings), correct_option_index (0-3), max_marks, mark_scheme ([{label, marks}])`,

  short_answer: `Generate a short-answer question requiring 2–4 sentences. Include line references or stimulus material if relevant.
Return JSON fields: question_text, max_marks, mark_scheme ([{label, description, marks}]) — each criterion worth 1 mark`,

  long_answer: `Generate a structured essay/extended answer question worth multiple marks.
Return JSON fields: question_text, max_marks, mark_scheme ([{label, description, marks}]) — group into assessment objectives (Knowledge, Application, Analysis, Evaluation)`,

  data_analysis: `Generate a data analysis question with a dataset. The dataset must be a markdown table or clearly formatted scenario with specific numerical values.
Return JSON fields: question_text, dataset (markdown table or scenario text), max_marks, mark_scheme ([{label, description, marks}])`,

  calculation: `Generate a quantitative calculation question. Include all necessary constants, units, and values in the question. Show the expected working in the mark scheme.
Return JSON fields: question_text, max_marks, mark_scheme ([{label, description, marks}]) — include Method (1), Substitution (1), Answer with units (1+) criteria`,
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Easy — guided and scaffolded, tests basic recall and simple one-step application',
  2: 'Medium-Easy — straightforward application, accessible one or two-step problems',
  3: 'Standard — typical exam-level question requiring genuine understanding and application',
  4: 'Hard — multi-step, requires analysis, synthesis, or evaluation across concepts',
  5: 'Stretch — challenging beyond standard exam level, requires deep insight or novel application',
};

export function buildExamQuestionPrompt(params: {
  sectionName: string;
  questionType: string;
  marksForQuestion: number;
  topicName: string;
  subjectName?: string;
  courseName: string;
  examName?: string;
  levelLabel: string;
  existingQuestions?: string[];
  difficulty?: number;
}): string {
  const typeInstructions = QUESTION_TYPE_INSTRUCTIONS[params.questionType]
    ?? QUESTION_TYPE_INSTRUCTIONS.short_answer;

  const avoidBlock = params.existingQuestions?.length
    ? `\n\nDo NOT repeat or closely paraphrase these already-generated questions:\n${params.existingQuestions.slice(0, 6).map(q => `- "${q}"`).join('\n')}`
    : '';

  const difficultyLine = params.difficulty !== undefined
    ? `\nDifficulty: ${DIFFICULTY_LABELS[params.difficulty] ?? DIFFICULTY_LABELS[3]}`
    : '';

  return `You are an expert ${params.examName ? `${params.examName} ` : ''}question setter generating a single exam question for a ${params.levelLabel} student.

Course: "${params.courseName}"
Topic: "${params.topicName}"${params.subjectName ? `\nSubject: "${params.subjectName}"` : ''}
Section: "${params.sectionName}"
Question type: ${params.questionType.replace('_', ' ')}
Marks available: ${params.marksForQuestion}${difficultyLine}${avoidBlock}

${typeInstructions}

Quality requirements:
- Test genuine understanding — mechanism, application, analysis, evaluation, or synthesis (NOT surface recall or definition repetition)
- Mark scheme must be specific, unambiguous, and examinable — each criterion must be directly observable in the student's written answer
- Difficulty calibrated precisely to the specified difficulty level above
- For calculation questions: include every piece of data the student needs; state units
- For data analysis: dataset must have ≥4 data points; question must require processing the data (not just reading it off)

Notation: use LaTeX for all math and chemistry — inline math $...$, display math $$...$$, chemical formulas/equations \ce{...} (e.g. \ce{H2SO4}, \ce{Ca^{2+}}, \ce{2H2 + O2 -> 2H2O}).

Return ONLY valid JSON — no markdown, no code fences:
{
  "question_text": "...",
  [additional fields depending on type]
  "max_marks": ${params.marksForQuestion},
  "mark_scheme": [{"label": "...", "description": "...", "marks": 1}]
}`;
}

// ─── Marking ───────────────────────────────────────────────────────────────────

export function buildMarkingPrompt(params: {
  questionText: string;
  questionType: string;
  dataset?: string;
  markScheme: MarkCriterion[];
  maxMarks: number;
  studentAnswer: string;
}): string {
  const schemeText = params.markScheme
    .map(c => `  - ${c.label}${c.description ? ': ' + c.description : ''} [${c.marks} mark${c.marks !== 1 ? 's' : ''}]`)
    .join('\n');

  return `You are an examiner marking a student's answer. Award marks strictly according to the mark scheme.

Question: ${params.questionText}
${params.dataset ? `\nData / Context:\n${params.dataset}\n` : ''}
Mark Scheme (${params.maxMarks} marks total):
${schemeText}

Student's Answer:
${params.studentAnswer}

Instructions:
- Award marks only for content clearly present in the student's answer
- Partial credit is allowed where mark scheme permits multi-mark criteria
- Total score must not exceed ${params.maxMarks}
- Feedback should explain what was awarded and what was missing, with reference to specific mark scheme points
- Keep feedback concise (3–6 sentences)

Return ONLY valid JSON:
{
  "score": 2,
  "feedback": "Your explanation here.",
  "criteria_awarded": [
    {"label": "Criterion name", "awarded": true},
    {"label": "Another criterion", "awarded": false, "note": "Missing specific detail about X"}
  ]
}`;
}

// ─── Hints ─────────────────────────────────────────────────────────────────────

export function buildHintPrompt(params: {
  questionText: string;
  questionType: string;
  dataset?: string;
  studentAnswer?: string;
  hintsUsed: number;
}): string {
  const specificity = params.hintsUsed === 0
    ? 'Give a broad Socratic hint that points the student toward the right approach without revealing any answer content.'
    : 'The student has already received one hint. Give a more specific hint that clarifies the key concept or method they are missing — but still do not reveal the answer directly.';

  return `You are a tutor helping a student with an exam question. Do NOT give the answer.

Question: ${params.questionText}
Question type: ${params.questionType.replace('_', ' ')}
${params.dataset ? `\nData / Context:\n${params.dataset}\n` : ''}${params.studentAnswer?.trim() ? `\nStudent's current answer:\n${params.studentAnswer}\n` : ''}

${specificity}

Respond with a single concise hint (2–3 sentences maximum). Do NOT quote the mark scheme or reveal any mark scheme points directly.`;
}
