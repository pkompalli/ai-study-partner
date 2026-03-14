import { chatCompletion } from '@/lib/llm/client';
import { buildExamFormatInferPrompt, buildExamFormatFromDescriptionPrompt, buildExamQuestionPrompt, buildPaperExtractionPrompt } from '@/lib/llm/examPrompts';
import { inferAcademicLevel } from '@/lib/llm/prompts';
import { extractTextFromPdfBuffer } from '@/lib/llm/pdfText';
import type { ExamSection, MarkCriterion } from '@/types';

export interface TopicRef {
  id: string;
  name: string;
  subjectName?: string;
  chapterName?: string;
  /** Chapters before the current one (allowed as prior knowledge) */
  priorChapters?: string[];
  /** Chapters after the current one (FORBIDDEN — not yet covered) */
  laterChapters?: string[];
  /** Actual lesson summary content for the chapter — used to positively ground the LLM */
  chapterContent?: string;
}

export interface GeneratedQuestion {
  section_id: string;
  topic_id?: string;
  question_text: string;
  dataset?: string;
  options?: string[];
  correct_option_index?: number;
  max_marks: number;
  mark_scheme: MarkCriterion[];
  image?: { query: string; alt: string };
}

/**
 * Generate a concise key-points outline for a chapter when no cached summary exists.
 * Used as positive grounding for exam question generation. */
export async function generateChapterKeyPoints(params: {
  chapterName: string;
  topicName: string;
  courseName: string;
  siblingChapters?: string[];
}): Promise<string> {
  const siblingsCtx = params.siblingChapters?.length
    ? `\nOther chapters in this topic (for context on scope boundaries): ${params.siblingChapters.map(s => `"${s}"`).join(', ')}`
    : '';

  const prompt = `You are a curriculum expert. List the key concepts, formulas, and techniques covered in the chapter "${params.chapterName}" within the topic "${params.topicName}" for the course "${params.courseName}".${siblingsCtx}

IMPORTANT: List ONLY concepts that belong specifically to "${params.chapterName}". Do NOT include concepts from other chapters.

Format: A concise bulleted list of 10-20 key points. Each point should name a specific concept, law, formula, or technique. Be specific (e.g., "Brønsted-Lowry definition of acids and bases" not just "acid-base theory").`;

  try {
    const raw = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, maxTokens: 800 },
    );
    console.log(`[examQ] generated key points for "${params.chapterName}" (${raw.length} chars)`);
    return raw.trim();
  } catch (err) {
    console.warn(`[examQ] failed to generate key points for "${params.chapterName}":`, err);
    return '';
  }
}

interface InferredFormat {
  name: string;
  description?: string;
  total_marks?: number;
  time_minutes?: number;
  instructions?: string;
  sections: Array<{
    name: string;
    question_type: string;
    num_questions: number;
    marks_per_question?: number;
    total_marks?: number;
    instructions?: string;
    num_options?: number;
  }>;
}

const QUESTION_TYPE_ALIASES: Record<string, string> = {
  mcq: 'mcq',
  multiple_choice: 'mcq',
  multiplechoice: 'mcq',
  objective: 'mcq',
  short_answer: 'short_answer',
  shortanswer: 'short_answer',
  saq: 'short_answer',
  long_answer: 'long_answer',
  longanswer: 'long_answer',
  essay: 'long_answer',
  data_analysis: 'data_analysis',
  dataanalysis: 'data_analysis',
  analysis: 'data_analysis',
  calculation: 'calculation',
  numerical: 'calculation',
  problem_solving: 'calculation',
  ranking: 'ranking',
  sjt: 'ranking',
  situational_judgement: 'ranking',
  situational_judgement_test: 'ranking',
  scenario: 'scenario',
  scenario_based: 'scenario',
};

function normalizeQuestionType(raw: unknown): string {
  const key = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return QUESTION_TYPE_ALIASES[key] ?? 'short_answer';
}

function sanitizeInferredFormat(raw: Partial<InferredFormat>, examName: string): InferredFormat {
  const sourceSections = Array.isArray(raw.sections) ? raw.sections : [];
  const sections = sourceSections
    .map((s, idx) => ({
      name: String(s?.name ?? '').trim() || `Section ${String.fromCharCode(65 + idx)}`,
      question_type: normalizeQuestionType(s?.question_type),
      num_questions: Math.max(1, Math.round(Number(s?.num_questions ?? 0) || 0)),
      marks_per_question: (typeof s?.marks_per_question === 'number' && s.marks_per_question > 0) ? s.marks_per_question : undefined,
      total_marks: (typeof s?.total_marks === 'number' && s.total_marks > 0) ? s.total_marks : undefined,
      instructions: typeof s?.instructions === 'string' ? s.instructions : undefined,
      num_options: (() => { const n = (s as Record<string, unknown>)?.num_options; return typeof n === 'number' && n >= 3 && n <= 6 ? n : undefined; })(),
    }))
    .filter((s) => s.name.length > 0 && s.num_questions > 0);

  const fallbackSections = sections.length > 0
    ? sections
    : [
      { name: 'Section A — Multiple Choice', question_type: 'mcq', num_questions: 20, marks_per_question: 1, instructions: 'Answer all questions.' },
      { name: 'Section B — Short Answer', question_type: 'short_answer', num_questions: 5, marks_per_question: 4, instructions: 'Answer any 5 questions.' },
    ];

  return {
    name: String(raw.name ?? '').trim() || examName,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    total_marks: (typeof raw.total_marks === 'number' && raw.total_marks > 0) ? raw.total_marks : undefined,
    time_minutes: (typeof raw.time_minutes === 'number' && raw.time_minutes > 0) ? raw.time_minutes : undefined,
    instructions: typeof raw.instructions === 'string' ? raw.instructions : undefined,
    sections: fallbackSections,
  };
}

// ─── Extract text from PDF ────────────────────────────────────────────────────

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return extractTextFromPdfBuffer(buffer, 30);
}

// ─── Extracted paper result ───────────────────────────────────────────────────

export interface ExtractedSection {
  name: string;
  question_type: string;
  num_questions: number;
  marks_per_question?: number;
  instructions?: string;
}

export interface ExtractedQuestion {
  section_index: number;
  question_text: string;
  dataset?: string;
  options?: string[];
  correct_option_index?: number;
  max_marks: number;
  mark_scheme: MarkCriterion[];
}

export interface PaperExtractionResult {
  name: string;
  total_marks?: number;
  time_minutes?: number;
  instructions?: string;
  sections: ExtractedSection[];
  questions: ExtractedQuestion[];
  questions_truncated: boolean;
}

export async function extractExamFromPaper(
  source: { type: 'pdf'; buffer: Buffer } | { type: 'images'; images: { base64: string; mimeType: string }[] },
): Promise<PaperExtractionResult> {
  let paperText: string;

  if (source.type === 'pdf') {
    paperText = await extractTextFromPDF(source.buffer);
    console.log(`[extractExamFromPaper] extracted ${paperText.length} chars from PDF`);
  } else {
    // Vision: describe image content as text-like prompt
    const imageParts = source.images.map(img => ({
      type: 'image' as const,
      image: img.base64,
      mimeType: img.mimeType,
    }));

    const raw = await chatCompletion([
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildPaperExtractionPrompt('[See attached images — extract all questions and exam format from them]'),
          },
          ...imageParts,
        ],
      },
    ], { temperature: 0.2, maxTokens: 6000 });

    return parsePaperExtractionResult(raw);
  }

  const prompt = buildPaperExtractionPrompt(paperText);
  const raw = await chatCompletion(
    [{ role: 'user', content: prompt }],
    { temperature: 0.2, maxTokens: 6000 },
  );

  return parsePaperExtractionResult(raw);
}

function parsePaperExtractionResult(raw: string): PaperExtractionResult {
  let parsed: PaperExtractionResult;

  const cleaned = raw.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Try multiple parse strategies: raw → fixed LaTeX → extracted → extracted+fixed
  const candidates: string[] = [cleaned, fixLaTeXBackslashes(cleaned)];
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    candidates.push(match[0], fixLaTeXBackslashes(match[0]));
  }

  let lastErr: unknown;
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate);
      // success — jump to normalization below
      if (!Array.isArray(parsed!.sections)) parsed!.sections = [];
      if (!Array.isArray(parsed!.questions)) parsed!.questions = [];
      parsed!.questions = parsed!.questions.map(q => ({
        ...q,
        mark_scheme: Array.isArray(q.mark_scheme) ? q.mark_scheme : [],
        max_marks: typeof q.max_marks === 'number' ? q.max_marks : 1,
      }));
      return parsed!;
    } catch (err) {
      lastErr = err;
    }
  }

  console.error('[parsePaperExtraction] all parse strategies failed. Raw (first 500):', raw.slice(0, 500));
  throw lastErr ?? new Error('Failed to parse paper extraction result');
}

// ─── Infer exam format from name ──────────────────────────────────────────────

/** Try to web-search for exam format details */
async function webResearchExamFormat(examName: string): Promise<string | undefined> {
  try {
    const query = `${examName} exam format structure sections marks time number of questions`;
    const res = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    // Extract text snippets from search results
    const stripped = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000);
    return stripped || undefined;
  } catch {
    console.log('[examQ] web research failed, proceeding with LLM knowledge');
    return undefined;
  }
}

export async function inferExamFormat(examName: string, courseName: string): Promise<InferredFormat> {
  // Try web research for well-known exams
  const webResearch = await webResearchExamFormat(examName);
  const prompt = buildExamFormatInferPrompt(examName, courseName, webResearch);
  const raw = await chatCompletion(
    [{ role: 'user', content: prompt }],
    { temperature: 0.3, maxTokens: 1200 },
  );

  let parsed: Partial<InferredFormat> = {};
  try {
    const cleaned = raw.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = {};
      }
    }
  }

  return sanitizeInferredFormat(parsed, examName);
}

// ─── Infer exam format from free text description ────────────────────────────

export async function inferExamFormatFromDescription(description: string, courseName: string): Promise<InferredFormat> {
  const prompt = buildExamFormatFromDescriptionPrompt(description, courseName);
  const raw = await chatCompletion(
    [{ role: 'user', content: prompt }],
    { temperature: 0.3, maxTokens: 1200 },
  );

  let parsed: Partial<InferredFormat> = {};
  try {
    const cleaned = raw.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = {};
      }
    }
  }

  return sanitizeInferredFormat(parsed, parsed.name ?? 'Exam');
}

// ─── Generate question bank ───────────────────────────────────────────────────

/** Run all question generations with bounded concurrency */
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 8,
): Promise<Array<T | null>> {
  const results: Array<T | null> = new Array(tasks.length).fill(null);

  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(t => t()));
    settled.forEach((r, j) => {
      if (r.status === 'rejected') {
        console.error(`[examQ] task ${i + j} rejected:`, r.reason);
      }
      results[i + j] = r.status === 'fulfilled' ? r.value : null;
    });
  }

  return results;
}

/** Derive a sensible difficulty level from the marks allocated when no explicit difficulty is set.
 *  1 mark → recall (1), 2 → application (2), 3 → standard (3), 4 → hard (4), 5+ → stretch (5). */
function marksToDefaultDifficulty(marks: number): number {
  if (marks <= 1) return 1;
  if (marks <= 2) return 2;
  if (marks <= 3) return 3;
  if (marks <= 4) return 4;
  return 5;
}

function getMaxTokensForType(questionType: string): number {
  switch (questionType) {
    case 'long_answer': return 1400;
    case 'data_analysis': return 1400;
    case 'calculation': return 900;
    case 'short_answer': return 900;
    case 'ranking': return 1400;
    case 'scenario': return 1400;
    default: return 700;
  }
}

/**
 * The LLM often emits LaTeX backslash commands (\\mathrm, \\Delta, \\ce, \\,) directly
 * inside JSON string values without doubling the backslash.  JSON only permits the
 * escape sequences: \" \\ \/ \b \f \n \r \t \uXXXX — anything else (e.g. \m, \D, \c)
 * is a syntax error.  This helper fixes those bare backslashes while leaving already-
 * doubled sequences (\\\\) and valid JSON escapes intact.
 */
function fixLaTeXBackslashes(s: string): string {
  // Negative lookbehind: only match a backslash NOT preceded by another backslash
  // Negative lookahead:  skip sequences that are already valid JSON escape characters
  return s.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, '\\\\');
}

function parseGeneratedQuestion(
  raw: string,
  section: ExamSection,
  topicId: string | undefined,
  defaultMarks: number,
): GeneratedQuestion | null {
  let parsed: Record<string, unknown> | undefined;

  // Try strategies in order: raw → fixed → extracted → extracted+fixed
  const candidates: string[] = [raw.trim(), fixLaTeXBackslashes(raw.trim())];
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    candidates.push(match[0], fixLaTeXBackslashes(match[0]));
  }

  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate) as Record<string, unknown>;
      break;
    } catch {
      // try next candidate
    }
  }

  if (!parsed) {
    console.error('[examQ] parse failed for all strategies. Raw (first 300):', raw.slice(0, 300));
    return null;
  }

  if (!parsed['question_text'] || typeof parsed['question_text'] !== 'string') {
    console.error('[examQ] missing/invalid question_text. Keys:', Object.keys(parsed));
    return null;
  }

  // Extract image field if present
  let image: { query: string; alt: string } | undefined;
  if (parsed['image'] && typeof parsed['image'] === 'object') {
    const img = parsed['image'] as Record<string, unknown>;
    if (typeof img.query === 'string' && typeof img.alt === 'string') {
      image = { query: img.query, alt: img.alt };
    }
  }

  return {
    section_id: section.id,
    topic_id: topicId,
    question_text: parsed['question_text'] as string,
    dataset: typeof parsed['dataset'] === 'string' ? parsed['dataset'] : undefined,
    options: Array.isArray(parsed['options']) ? parsed['options'] as string[] : undefined,
    correct_option_index: typeof parsed['correct_option_index'] === 'number'
      ? parsed['correct_option_index'] as number : undefined,
    max_marks: typeof parsed['max_marks'] === 'number'
      ? parsed['max_marks'] as number : defaultMarks,
    mark_scheme: Array.isArray(parsed['mark_scheme'])
      ? parsed['mark_scheme'] as MarkCriterion[] : [],
    image,
  };
}

export async function generateExamQuestions(params: {
  sections: ExamSection[];
  topics: TopicRef[];
  courseName: string;
  examName?: string;
  yearOfStudy?: string;
  /** When set, generate exactly this many questions distributed round-robin across sections */
  batchCount?: number;
  /** 1=Easy, 2=Medium-Easy, 3=Standard, 4=Hard, 5=Stretch */
  difficulty?: number;
}): Promise<GeneratedQuestion[]> {
  const { sections, topics, courseName, examName, yearOfStudy, batchCount, difficulty } = params;
  if (topics.length === 0 || sections.length === 0) return [];

  const level = inferAcademicLevel(yearOfStudy, courseName);
  const tasks: Array<() => Promise<GeneratedQuestion | null>> = [];

  if (batchCount !== undefined) {
    // Batch mode: generate SEQUENTIALLY so each question receives real text of prior questions
    // as context, preventing the LLM from repeating the same "most obvious" example.
    const batchResults: GeneratedQuestion[] = [];
    const seenTexts: string[] = [];
    let firstError: unknown = null;

    for (let qi = 0; qi < batchCount; qi++) {
      const section = sections[qi % sections.length];
      const topic = topics[qi % topics.length];
      const defaultMarks = section.marks_per_question
        ?? (section.total_marks ? Math.round(section.total_marks / section.num_questions) : 1);

      const prompt = buildExamQuestionPrompt({
        sectionName: section.name,
        questionType: section.question_type,
        marksForQuestion: defaultMarks,
        topicName: topic.name,
        subjectName: topic.subjectName,
        chapterName: topic.chapterName,
        chapterContent: topic.chapterContent,
        priorChapters: topic.priorChapters,
        laterChapters: topic.laterChapters,
        courseName,
        examName,
        levelLabel: level.label,
        difficulty: difficulty ?? marksToDefaultDifficulty(defaultMarks),
        existingQuestions: [...seenTexts],
        numOptions: section.num_options,
      });

      if (qi === 0) {
        console.log(`[examQ] batch prompt scope — topic: "${topic.name}", chapter: "${topic.chapterName ?? 'none'}", prior: [${(topic.priorChapters ?? []).join(', ')}], forbidden: [${(topic.laterChapters ?? []).join(', ')}]`);
        console.log(`[examQ] prompt snippet (first 600):`, prompt.slice(0, 600));
      }

      try {
        const raw = await chatCompletion(
          [{ role: 'user', content: prompt }],
          { temperature: 0.9, maxTokens: getMaxTokensForType(section.question_type) },
        );
        const result = parseGeneratedQuestion(raw, section, topic.id, defaultMarks);
        if (result) {
          batchResults.push(result);
          seenTexts.push(result.question_text.replace(/\s+/g, ' ').slice(0, 120));
        }
      } catch (err) {
        if (!firstError) firstError = err;
        console.warn(`[examQ batch] question ${qi + 1} failed:`, err);
      }
    }

    if (batchResults.length === 0 && firstError) {
      if (firstError instanceof Error) {
        throw new Error(`Question generation failed: ${firstError.message}`);
      }
      throw new Error('Question generation failed');
    }

    console.log(`[examQ] generated ${batchResults.length}/${batchCount} questions (sequential batch)`);
    return batchResults;
  } else {
    // Full generation mode: respect section.num_questions per section
    for (const section of sections) {
      const existingQuestionsForSection: string[] = [];
      const defaultMarks = section.marks_per_question
        ?? (section.total_marks ? Math.round(section.total_marks / section.num_questions) : 1);

      for (let qi = 0; qi < section.num_questions; qi++) {
        const topic = topics[qi % topics.length];
        const capturedExisting = [...existingQuestionsForSection];

        tasks.push(async (): Promise<GeneratedQuestion | null> => {
          const prompt = buildExamQuestionPrompt({
            sectionName: section.name,
            questionType: section.question_type,
            marksForQuestion: defaultMarks,
            topicName: topic.name,
            subjectName: topic.subjectName,
            chapterName: topic.chapterName,
            priorChapters: topic.priorChapters,
            laterChapters: topic.laterChapters,
            courseName,
            examName,
            levelLabel: level.label,
            existingQuestions: capturedExisting,
            difficulty: difficulty ?? marksToDefaultDifficulty(defaultMarks),
            numOptions: section.num_options,
          });
          const raw = await chatCompletion(
            [{ role: 'user', content: prompt }],
            { temperature: 0.85, maxTokens: getMaxTokensForType(section.question_type) },
          );
          return parseGeneratedQuestion(raw, section, topic.id, defaultMarks);
        });

        existingQuestionsForSection.push(`[question ${qi + 1} for ${topic.name}]`);
      }
    }
  }

  const results = await runWithConcurrency(tasks, 8);
  const valid = results.filter((r): r is GeneratedQuestion => r !== null);
  console.log(`[examQ] generated ${valid.length}/${tasks.length} questions (${tasks.length - valid.length} failed)`);
  return valid;
}

// ─── Example question generation (for setup preview) ────────────────────────

export interface ExampleQuestion {
  sectionName: string;
  questionType: string;
  question_text: string;
  options?: string[];
  correct_option_index?: number;
  max_marks: number;
  dataset?: string;
}

/**
 * Generate 1 example question per section for preview during format setup.
 * These are lightweight and don't need full grounding — just to show format/style.
 */
export async function generateExampleQuestions(params: {
  sections: Array<{ name: string; question_type: string; marks_per_question?: number; num_options?: number }>;
  courseName: string;
  examName?: string;
}): Promise<ExampleQuestion[]> {
  const { sections, courseName, examName } = params;

  const tasks = sections.map(section => async (): Promise<ExampleQuestion | null> => {
    const marks = section.marks_per_question ?? 1;
    const numOptions = section.num_options ?? 4;
    const optionLine = section.question_type === 'mcq'
      ? `Generate exactly ${numOptions} options (A-${String.fromCharCode(64 + numOptions)}).`
      : '';

    const prompt = `Generate a single realistic example ${section.question_type.replace('_', ' ')} question for a ${examName ?? 'course exam'} in "${courseName}".

Section: "${section.name}"
Marks: ${marks}
${optionLine}

This is a PREVIEW question to show the student what questions will look like. Make it representative of the exam style and difficulty.

Return ONLY valid JSON — no markdown, no code fences:
{
  "question_text": "...",
  ${section.question_type === 'mcq' ? `"options": ["A...", "B...", ...],\n  "correct_option_index": 0,` : ''}
  ${['data_analysis', 'ranking', 'scenario'].includes(section.question_type) ? `"dataset": "...",` : ''}
  "max_marks": ${marks}
}`;

    try {
      const raw = await chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.8, maxTokens: 600 },
      );

      const cleaned = raw.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) return null;
        parsed = JSON.parse(match[0]);
      }

      return {
        sectionName: section.name,
        questionType: section.question_type,
        question_text: String(parsed.question_text ?? ''),
        options: Array.isArray(parsed.options) ? parsed.options as string[] : undefined,
        correct_option_index: typeof parsed.correct_option_index === 'number' ? parsed.correct_option_index : undefined,
        max_marks: typeof parsed.max_marks === 'number' ? parsed.max_marks : marks,
        dataset: typeof parsed.dataset === 'string' ? parsed.dataset : undefined,
      };
    } catch (err) {
      console.warn(`[examQ] example question for "${section.name}" failed:`, err);
      return null;
    }
  });

  const results = await Promise.allSettled(tasks.map(t => t()));
  return results
    .filter((r): r is PromiseFulfilledResult<ExampleQuestion | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((r): r is ExampleQuestion => r !== null);
}
