import type { MarkCriterion } from '@/types';

// ─── Homework problem generation ────────────────────────────────────────────

export function buildHomeworkProblemPrompt(params: {
  topicName: string;
  chapterName?: string;
  chapterContent?: string;
  priorChapters?: string[];
  laterChapters?: string[];
  courseName: string;
  difficulty?: number;
  existingQuestions?: string[];
  problemStyle: 'conceptual' | 'worked_example' | 'multi_part' | 'application';
}): string {
  const diffLabel = ['Foundational', 'Building', 'Standard', 'Challenging', 'Extension'][
    (params.difficulty ?? 3) - 1
  ] ?? 'Standard';

  const styleInstructions: Record<string, string> = {
    conceptual: `Generate a conceptual understanding question that tests whether the student truly grasps the "why" behind the concept — not just the "how".
Avoid pure recall. Instead, ask the student to explain, compare, predict, or reason about the concept.
Return JSON: { "question_text": "...", "max_marks": N, "mark_scheme": [{label, description, marks}], "worked_solution": "step-by-step solution showing reasoning" }`,

    worked_example: `Generate a problem AND provide a detailed worked example of a similar (but different) problem first.
The worked example teaches the method; the practice problem lets the student apply it.
Return JSON: { "worked_example": { "problem": "...", "solution": "step-by-step..." }, "question_text": "Now try this: ...", "max_marks": N, "mark_scheme": [{label, description, marks}], "worked_solution": "step-by-step solution" }`,

    multi_part: `Generate a multi-part problem (2-4 parts) that scaffolds from easier to harder, building on each part.
Part (a) should be accessible, each subsequent part builds on the previous answer.
Return JSON: { "question_text": "(a) ... \\n(b) ... \\n(c) ...", "max_marks": N, "mark_scheme": [{label, description, marks}], "worked_solution": "Part (a): ...\\nPart (b): ...\\nPart (c): ..." }`,

    application: `Generate a real-world application problem that connects the concept to practical situations.
Include context/scenario that makes the problem feel relevant and interesting.
Return JSON: { "dataset": "scenario/context description", "question_text": "...", "max_marks": N, "mark_scheme": [{label, description, marks}], "worked_solution": "step-by-step solution" }`,
  };

  const avoidBlock = params.existingQuestions?.length
    ? `\n\nDo NOT repeat or closely paraphrase these already-generated questions:\n${params.existingQuestions.slice(0, 6).map(q => `- "${q}"`).join('\n')}`
    : '';

  const chapterContentBlock = params.chapterContent
    ? `\n\nChapter content (use ONLY concepts from this material):\n---\n${params.chapterContent.slice(0, 3000)}\n---`
    : '';

  const priorBlock = params.priorChapters?.length
    ? `\nPrior chapters the student has studied: ${params.priorChapters.join(', ')}`
    : '';

  const laterBlock = params.laterChapters?.length
    ? `\nFORBIDDEN — these chapters have NOT been studied yet: ${params.laterChapters.join(', ')}`
    : '';

  return `You are a thoughtful tutor creating homework for a student studying "${params.courseName}".

Topic: "${params.topicName}"${params.chapterName ? ` — Chapter: "${params.chapterName}"` : ''}
Difficulty: ${diffLabel} (${params.difficulty ?? 3}/5)
${priorBlock}${laterBlock}${chapterContentBlock}

PURPOSE: This is HOMEWORK — meant for LEARNING and REINFORCEMENT, not exam preparation.
- Focus on building understanding, not testing under pressure
- Include teaching moments in the solution
- Be encouraging in tone
- The worked_solution should explain the "why" at each step, not just the "what"

${styleInstructions[params.problemStyle]}${avoidBlock}

Return ONLY valid JSON — no markdown, no code fences.`;
}

// ─── Homework feedback on uploaded work ─────────────────────────────────────

export function buildHomeworkFeedbackPrompt(params: {
  studentWork: string;
  courseName: string;
  topicName?: string;
  chapterName?: string;
}): string {
  const scopeBlock = params.topicName
    ? `Topic: "${params.topicName}"${params.chapterName ? ` — Chapter: "${params.chapterName}"` : ''}`
    : 'Topic: (infer from the student\'s work)';

  return `You are a supportive and thorough tutor reviewing a student's homework for "${params.courseName}".
${scopeBlock}

The student has submitted their work (problems and solutions) for review. Analyze it carefully and provide detailed, constructive feedback.

Student's work:
---
${params.studentWork.slice(0, 15000)}
---

Provide feedback in this JSON format — return ONLY valid JSON, no markdown, no code fences:
{
  "summary": "2-3 sentence overall assessment — start with what they did well",
  "score_estimate": "A qualitative assessment: Excellent / Good / Developing / Needs Work",
  "strengths": [
    { "area": "short label", "detail": "specific praise with examples from their work" }
  ],
  "areas_to_improve": [
    { "area": "short label", "detail": "specific constructive feedback with examples", "suggestion": "actionable tip to improve" }
  ],
  "misconceptions": [
    { "concept": "the misunderstood concept", "what_student_did": "what they wrote/did wrong", "correction": "clear explanation of the correct understanding" }
  ],
  "topics_to_review": ["topic1", "topic2"],
  "next_steps": "1-2 sentences on what to practice next"
}

Rules:
- Be encouraging and constructive — never harsh or dismissive
- Be SPECIFIC — reference actual problems/answers from the student's work
- If work is mostly correct, still find areas for deeper understanding
- If work has significant errors, be gentle but clear about what needs fixing
- misconceptions array can be empty if there are none
- Identify 2-5 strengths and 2-5 areas to improve
- topics_to_review should be specific chapter/concept names, not generic advice`;
}

// ─── Homework marking prompt (similar to exam but more teaching-oriented) ───

export function buildHomeworkMarkingPrompt(params: {
  questionText: string;
  studentAnswer: string;
  maxMarks: number;
  markScheme: MarkCriterion[];
  workedSolution?: string;
}): string {
  const schemeText = params.markScheme
    .map(c => `- ${c.label}${c.description ? `: ${c.description}` : ''} (${c.marks} mark${c.marks !== 1 ? 's' : ''})`)
    .join('\n');

  return `You are a supportive tutor marking homework. Your goal is to help the student LEARN, not just assign a score.

Question:
${params.questionText}

Mark scheme (${params.maxMarks} marks total):
${schemeText}
${params.workedSolution ? `\nModel solution:\n${params.workedSolution}` : ''}

Student's answer:
${params.studentAnswer}

Return ONLY valid JSON:
{
  "score": <number 0-${params.maxMarks}>,
  "feedback": "Detailed feedback: what was correct, what was missing, and a brief teaching explanation for any errors. Be encouraging."
}

Rules:
- Award partial credit generously — reward understanding even if execution is imperfect
- Explain WHY something is wrong, don't just say it's wrong
- If the student's approach is valid but different from the mark scheme, still award marks
- End with a brief encouraging note or learning tip`;
}
