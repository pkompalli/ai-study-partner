import { chatCompletion } from '@/lib/llm/client';
import { buildExamFormatInferPrompt, buildExamQuestionPrompt, buildPaperExtractionPrompt } from '@/lib/llm/examPrompts';
import { inferAcademicLevel } from '@/lib/llm/prompts';
import type { ExamSection, MarkCriterion } from '@/types';

export interface TopicRef {
  id: string;
  name: string;
  subjectName?: string;
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
  // Dynamic import to avoid module-level init errors in Next.js RSC environment
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8 = new Uint8Array(buffer);
  const doc = await (pdfjsLib as unknown as { getDocument: (opts: unknown) => { promise: Promise<unknown> } })
    .getDocument({ data: uint8, verbosity: 0 }).promise as {
      numPages: number;
      getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }>;
      destroy: () => Promise<void>;
    };

  const pageTexts: string[] = [];
  const maxPages = Math.min(doc.numPages, 30); // cap at 30 pages

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    const lines: string[] = [];
    let currentLine = '';
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = item.str;
      } else {
        currentLine += (currentLine && item.str && !currentLine.endsWith(' ') ? ' ' : '') + item.str;
      }
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    pageTexts.push(lines.join('\n'));
  }

  await doc.destroy();
  return pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
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
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Failed to parse paper extraction result');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed.sections)) parsed.sections = [];
  if (!Array.isArray(parsed.questions)) parsed.questions = [];

  // Normalise mark_scheme fields
  parsed.questions = parsed.questions.map(q => ({
    ...q,
    mark_scheme: Array.isArray(q.mark_scheme) ? q.mark_scheme : [],
    max_marks: typeof q.max_marks === 'number' ? q.max_marks : 1,
  }));

  return parsed;
}

// ─── Infer exam format from name ──────────────────────────────────────────────

export async function inferExamFormat(examName: string, courseName: string): Promise<InferredFormat> {
  const prompt = buildExamFormatInferPrompt(examName, courseName);
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
        courseName,
        examName,
        levelLabel: level.label,
        difficulty: difficulty ?? marksToDefaultDifficulty(defaultMarks),
        existingQuestions: [...seenTexts],
      });

      try {
        const raw = await chatCompletion(
          [{ role: 'user', content: prompt }],
          { temperature: 0.9, maxTokens: getMaxTokensForType(section.question_type) },
        );
        const result = parseGeneratedQuestion(raw, section, topic.id, defaultMarks);
        if (result) {
          batchResults.push(result);
          // Store a concise snippet so the LLM knows what to avoid next time
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
            courseName,
            examName,
            levelLabel: level.label,
            existingQuestions: capturedExisting,
            difficulty: difficulty ?? marksToDefaultDifficulty(defaultMarks),
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
