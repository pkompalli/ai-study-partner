import type { MarkCriterion } from '@/types';

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
- question_type must be: mcq, short_answer, long_answer, data_analysis, calculation, ranking, scenario
- Use ranking for SJT (situational judgement test) style questions where candidates rank actions; use scenario for case-study or scenario-based questions
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
- Vary question types appropriately: exams with essays need long_answer; sciences need calculation; sciences/geography need data_analysis; medical/professional exams need ranking (SJT) and scenario`;
}

// ─── Format inference from free text description ──────────────────────────────

export function buildExamFormatFromDescriptionPrompt(description: string, courseName: string): string {
  return `You are an educational exam specialist. A user has described an exam format in free text. Parse their description into a structured exam format.

Course: "${courseName}"

User's description:
---
${description.slice(0, 5000)}
---

Return ONLY valid JSON — no markdown, no code fences, no extra text:
{
  "name": "Full exam name",
  "description": "Brief description of the exam format",
  "total_marks": 100,
  "time_minutes": 180,
  "instructions": "General exam instructions for the candidate (if mentioned, else null)",
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
- Extract as much structure as possible from the description
- If the user mentions specific section names, question types, mark allocations, or timings, use them
- If the user gives a well-known exam name (A-Level, IB, AP, SAT, GRE, GCSE), use the actual section structure for that exam, incorporating any specific details the user provided
- If details are vague or missing, make reasonable assumptions based on the subject and level
- Infer question types from context: "essay" → long_answer, "problems" → calculation, "multiple choice" → mcq, "SJT"/"situational judgement"/"ranking" → ranking, "scenario"/"case study" → scenario, etc.
- Always generate at least one section
- Total marks and time should be consistent with the sections`;
}

// ─── Question generation ───────────────────────────────────────────────────────

const QUESTION_TYPE_INSTRUCTIONS: Record<string, string> = {
  mcq: `Generate a multiple-choice question with exactly 4 options. ONE must be correct, THREE must be plausible distractors (common misconceptions, subtly wrong values, reversed causality).
Return JSON fields: question_text, options (array of 4 strings), correct_option_index (0-3), max_marks, mark_scheme ([{label, marks}]). Optionally include image ({query, alt}) if the question requires a visual.`,

  short_answer: `Generate a short-answer question requiring 2–4 sentences. Include line references or stimulus material if relevant.
Return JSON fields: question_text, max_marks, mark_scheme ([{label, description, marks}]) — each criterion worth 1 mark. Optionally include image ({query, alt}) if the question requires a visual.`,

  long_answer: `Generate a structured essay/extended answer question worth multiple marks.
Return JSON fields: question_text, max_marks, mark_scheme ([{label, description, marks}]) — group into assessment objectives (Knowledge, Application, Analysis, Evaluation). Optionally include image ({query, alt}) if the question requires a visual.`,

  data_analysis: `Generate a data analysis question with a dataset. The dataset must be a markdown table or clearly formatted scenario with specific numerical values.
Return JSON fields: question_text, dataset (markdown table or scenario text), max_marks, mark_scheme ([{label, description, marks}]). Optionally include image ({query, alt}) if the question references a diagram or graph.`,

  calculation: `Generate a quantitative calculation question. Include all necessary constants, units, and values in the question. Show the expected working in the mark scheme.
Return JSON fields: question_text, max_marks, mark_scheme ([{label, description, marks}]) — include Method (1), Substitution (1), Answer with units (1+) criteria. Optionally include image ({query, alt}) if the question references a diagram or apparatus setup.`,

  ranking: `Generate a scenario-based ranking question (SJT style). Write a realistic professional scenario as a "dataset" field, then present 5 actions that the candidate must rank from most to least appropriate.
Return JSON fields: dataset (the scenario text — a realistic workplace/clinical/professional situation, 3–5 sentences), question_text (e.g. "Rank the following actions in order of appropriateness (1 = Most appropriate, 5 = Least appropriate)."), options (array of exactly 5 action strings labelled A–E), correct_option_index (index 0–4 of the MOST appropriate action), max_marks, mark_scheme ([{label, description, marks}] — award marks for correct ranking positions).
The scenario must be specific, nuanced, and test professional judgement — not just factual knowledge. Include realistic tensions (e.g. patient safety vs team dynamics, urgency vs protocol).`,

  scenario: `Generate a scenario-based question. Write a realistic professional/clinical scenario as a "dataset" field, then ask the candidate what they would do or what the best course of action is.
Return JSON fields: dataset (the scenario — a realistic situation, 3–6 sentences with specific details), question_text (what the candidate must answer about the scenario), max_marks, mark_scheme ([{label, description, marks}]). For MCQ-style scenario questions, also include options (array of 4–5 strings) and correct_option_index. The scenario should test applied judgement and decision-making, not just recall.`,
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

IMAGE-BASED QUESTIONS: For topics where a visual is essential to the question (e.g. identifying biological structures from a micrograph, reading a phase diagram, interpreting an experimental setup, identifying geological features, anatomical labelling), you SHOULD include an image field:
  "image": {"query": "specific search query for the image", "alt": "what the image shows"}
The image will be fetched and displayed to the student alongside the question. Use this when:
- The question asks the student to identify, label, or interpret a visual (e.g. "Identify the organelle labelled X")
- The question references a diagram, graph, or photograph that the student needs to see
- The subject naturally requires visual stimuli (biology, anatomy, geography, chemistry apparatus, physics diagrams)
Do NOT use images for purely textual/mathematical questions.

Notation: use LaTeX for all math and chemistry. Inline math: $...$, display math: $$...$$ (for equations on their own line). NEVER use \\begin{align*}, \\begin{equation}, \\begin{aligned}, \\begin{array}, or any \\begin{}...\\end{} LaTeX environments — use $$...$$ for display math instead. Chemical formulas/equations MUST use \\ce{} INSIDE dollar signs: $\\ce{H2SO4}$, $\\ce{Ca^{2+}}$, $\\ce{2H2 + O2 -> 2H2O}$. ALL LaTeX — including \\ce{}, superscripts ^{}, subscripts _{}, Greek letters, units like \\mathrm{} — MUST be inside $...$ or $$...$$ delimiters. NEVER write bare LaTeX without $ delimiters. Use \\cdot (NOT \\cdotp) for multiplication dots and unit separators, e.g. $\\mathrm{J\\,mol^{-1}\\,K^{-1}}$.

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
  customRubric?: string;
}): string {
  const schemeText = params.markScheme
    .map(c => `  - ${c.label}${c.description ? ': ' + c.description : ''} [${c.marks} mark${c.marks !== 1 ? 's' : ''}]`)
    .join('\n');

  const rubricBlock = params.customRubric?.trim()
    ? `\nAdditional marking instructions:\n${params.customRubric.trim()}\n`
    : '';

  return `You are an examiner marking a student's answer. Award marks strictly according to the mark scheme.

Question: ${params.questionText}
${params.dataset ? `\nData / Context:\n${params.dataset}\n` : ''}
Mark Scheme (${params.maxMarks} marks total):
${schemeText}
${rubricBlock}
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

  return `You are a study mate helping a student with an exam question. Do NOT give the answer.

Question: ${params.questionText}
Question type: ${params.questionType.replace('_', ' ')}
${params.dataset ? `\nData / Context:\n${params.dataset}\n` : ''}${params.studentAnswer?.trim() ? `\nStudent's current answer:\n${params.studentAnswer}\n` : ''}

${specificity}

Respond with a single concise hint (2–3 sentences maximum). Do NOT quote the mark scheme or reveal any mark scheme points directly.`;
}

// ─── Full worked answer ────────────────────────────────────────────────────────

export function buildFullAnswerPrompt(params: {
  questionText: string;
  questionType: string;
  dataset?: string;
  markScheme: MarkCriterion[];
  maxMarks: number;
}): string {
  const schemeText = params.markScheme
    .map(c => `  - ${c.label}${c.description ? ': ' + c.description : ''} [${c.marks} mark${c.marks !== 1 ? 's' : ''}]`)
    .join('\n');

  return `You are an expert study mate. Provide the complete model answer and worked solution for this exam question.

Question: ${params.questionText}
${params.dataset ? `\nData / Context:\n${params.dataset}\n` : ''}
Mark Scheme (${params.maxMarks} marks total):
${schemeText}

Write a complete model answer that:
- Addresses every mark scheme point explicitly
- Shows all working, steps, and reasoning clearly
- For calculations: shows each algebraic/numerical step with correct units
- For essays/long-answer: structured paragraphs covering all assessment objectives
- Uses correct scientific/mathematical terminology throughout

Use LaTeX for all mathematical notation (inline: $...$, display: $$...$$). NEVER use \\begin{align*}, \\begin{equation}, or any \\begin{}...\\end{} environments — use $$...$$ for display math instead. Use $\\ce{}$ for chemical formulas and equations. Use \\cdot (NOT \\cdotp) for multiplication dots and unit separators. ALL units must be inside $...$, e.g. $\\mathrm{J\\,mol^{-1}\\,K^{-1}}$.

Respond with the complete answer only — no preamble.`;
}
