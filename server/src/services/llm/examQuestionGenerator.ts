import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import { chatCompletion } from './client.js';
import { buildExamFormatInferPrompt, buildExamQuestionPrompt, buildPaperExtractionPrompt } from './examPrompts.js';
import { inferAcademicLevel } from './prompts.js';
import type { ExamSection, MarkCriterion } from '../../db/examBank.db.js';

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

// ─── Extract text from PDF ────────────────────────────────────────────────────

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
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
      type: 'image_url' as const,
      image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'high' as const },
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
        ] as ChatCompletionContentPart[],
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

  let parsed: InferredFormat;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Failed to parse exam format from LLM response');
    parsed = JSON.parse(match[0]);
  }

  if (!parsed.name || !Array.isArray(parsed.sections)) {
    throw new Error('Invalid exam format structure from LLM');
  }

  return parsed;
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
      results[i + j] = r.status === 'fulfilled' ? r.value : null;
    });
  }

  return results;
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

function parseGeneratedQuestion(
  raw: string,
  section: ExamSection,
  topicId: string | undefined,
  defaultMarks: number,
): GeneratedQuestion | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (!parsed['question_text'] || typeof parsed['question_text'] !== 'string') return null;

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
    // Batch mode: distribute batchCount questions round-robin across sections
    for (let qi = 0; qi < batchCount; qi++) {
      const section = sections[qi % sections.length];
      const topic = topics[qi % topics.length];
      const defaultMarks = section.marks_per_question
        ?? (section.total_marks ? Math.round(section.total_marks / section.num_questions) : 1);

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
          difficulty,
        });
        const raw = await chatCompletion(
          [{ role: 'user', content: prompt }],
          { temperature: 0.85, maxTokens: getMaxTokensForType(section.question_type) },
        );
        return parseGeneratedQuestion(raw, section, topic.id, defaultMarks);
      });
    }
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
            difficulty,
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
  return results.filter((r): r is GeneratedQuestion => r !== null);
}
