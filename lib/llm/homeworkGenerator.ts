import { chatCompletion } from '@/lib/llm/client';
import { buildHomeworkProblemPrompt, buildHomeworkFeedbackPrompt, buildHomeworkMarkingPrompt } from '@/lib/llm/homeworkPrompts';
import { extractTextFromPdfBuffer } from '@/lib/llm/pdfText';
import type { MarkCriterion } from '@/types';

export interface HomeworkProblem {
  id: string;
  question_text: string;
  dataset?: string;
  max_marks: number;
  mark_scheme: MarkCriterion[];
  worked_solution: string;
  worked_example?: { problem: string; solution: string };
  problem_style: string;
  topic_name: string;
  chapter_name?: string;
}

export interface HomeworkFeedback {
  summary: string;
  score_estimate: string;
  strengths: Array<{ area: string; detail: string }>;
  areas_to_improve: Array<{ area: string; detail: string; suggestion: string }>;
  misconceptions: Array<{ concept: string; what_student_did: string; correction: string }>;
  topics_to_review: string[];
  next_steps: string;
}

export interface TopicRef {
  id: string;
  name: string;
  subjectName?: string;
  chapterName?: string;
  priorChapters?: string[];
  laterChapters?: string[];
  chapterContent?: string;
}

const PROBLEM_STYLES = ['conceptual', 'worked_example', 'multi_part', 'application'] as const;
type ProblemStyle = (typeof PROBLEM_STYLES)[number];

// ─── Generate homework problems ─────────────────────────────────────────────

export async function generateHomeworkProblems(params: {
  topics: TopicRef[];
  courseName: string;
  count?: number;
  difficulty?: number;
}): Promise<HomeworkProblem[]> {
  const { topics, courseName, count = 5, difficulty = 3 } = params;
  if (!topics.length) return [];

  const seenTexts: string[] = [];
  const tasks: Array<() => Promise<HomeworkProblem | null>> = [];

  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length];
    const style = PROBLEM_STYLES[i % PROBLEM_STYLES.length];

    tasks.push(async () => {
      const prompt = buildHomeworkProblemPrompt({
        topicName: topic.name,
        chapterName: topic.chapterName,
        chapterContent: topic.chapterContent,
        priorChapters: topic.priorChapters,
        laterChapters: topic.laterChapters,
        courseName,
        difficulty,
        existingQuestions: [...seenTexts],
        problemStyle: style,
      });

      const raw = await chatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.8, maxTokens: 1500 },
      );

      const parsed = parseJsonResponse(raw);
      if (!parsed) return null;

      const problem: HomeworkProblem = {
        id: `hw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        question_text: String(parsed.question_text ?? ''),
        dataset: typeof parsed.dataset === 'string' ? parsed.dataset : undefined,
        max_marks: typeof parsed.max_marks === 'number' ? parsed.max_marks : 4,
        mark_scheme: Array.isArray(parsed.mark_scheme) ? parsed.mark_scheme : [],
        worked_solution: String(parsed.worked_solution ?? ''),
        worked_example: parsed.worked_example && typeof parsed.worked_example === 'object'
          ? {
              problem: String((parsed.worked_example as Record<string, unknown>).problem ?? ''),
              solution: String((parsed.worked_example as Record<string, unknown>).solution ?? ''),
            }
          : undefined,
        problem_style: style,
        topic_name: topic.name,
        chapter_name: topic.chapterName,
      };

      if (problem.question_text) seenTexts.push(problem.question_text.slice(0, 100));
      return problem.question_text ? problem : null;
    });
  }

  const results = await runWithConcurrency(tasks, 5);
  return results.filter((r): r is HomeworkProblem => r !== null);
}

// ─── Analyze uploaded homework ──────────────────────────────────────────────

export async function analyzeHomework(params: {
  files: Array<{ base64: string; mimeType: string }>;
  pdfTexts: string[];
  courseName: string;
  topicName?: string;
  chapterName?: string;
}): Promise<HomeworkFeedback> {
  const { files, pdfTexts, courseName, topicName, chapterName } = params;

  // Build content parts for vision + text
  let studentWork = '';
  const contentParts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType: string }> = [];

  // Add PDF text
  if (pdfTexts.length) {
    studentWork = pdfTexts.join('\n\n---\n\n');
  }

  // Add images for vision
  const imageFiles = files.filter(f => f.mimeType.startsWith('image/'));
  if (imageFiles.length > 0) {
    contentParts.push(
      ...imageFiles.map(img => ({
        type: 'image' as const,
        image: img.base64,
        mimeType: img.mimeType,
      })),
    );
  }

  let raw: string;

  if (contentParts.length > 0) {
    // Use vision for images
    const prompt = buildHomeworkFeedbackPrompt({
      studentWork: studentWork || '[See attached images — analyze the student\'s handwritten/typed work]',
      courseName,
      topicName,
      chapterName,
    });
    contentParts.unshift({ type: 'text', text: prompt });

    raw = await chatCompletion(
      [{ role: 'user', content: contentParts }],
      { temperature: 0.3, maxTokens: 3000 },
    );
  } else if (studentWork) {
    // Text-only (PDF extracted text)
    const prompt = buildHomeworkFeedbackPrompt({
      studentWork,
      courseName,
      topicName,
      chapterName,
    });
    raw = await chatCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3, maxTokens: 3000 },
    );
  } else {
    throw new Error('No content to analyze');
  }

  const parsed = parseJsonResponse(raw);
  if (!parsed) throw new Error('Failed to parse feedback response');

  return {
    summary: String(parsed.summary ?? ''),
    score_estimate: String(parsed.score_estimate ?? 'N/A'),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    areas_to_improve: Array.isArray(parsed.areas_to_improve) ? parsed.areas_to_improve : [],
    misconceptions: Array.isArray(parsed.misconceptions) ? parsed.misconceptions : [],
    topics_to_review: Array.isArray(parsed.topics_to_review) ? parsed.topics_to_review : [],
    next_steps: String(parsed.next_steps ?? ''),
  };
}

// ─── Mark a homework problem ────────────────────────────────────────────────

export async function markHomeworkAnswer(params: {
  questionText: string;
  studentAnswer: string;
  maxMarks: number;
  markScheme: MarkCriterion[];
  workedSolution?: string;
  imageContent?: Array<{ base64: string; mimeType: string }>;
}): Promise<{ score: number; feedback: string }> {
  const { questionText, studentAnswer, maxMarks, markScheme, workedSolution, imageContent } = params;

  const prompt = buildHomeworkMarkingPrompt({
    questionText,
    studentAnswer,
    maxMarks,
    markScheme,
    workedSolution,
  });

  let raw: string;
  if (imageContent?.length) {
    const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType: string }> = [
      { type: 'text', text: prompt },
      ...imageContent.map(img => ({ type: 'image' as const, image: img.base64, mimeType: img.mimeType })),
    ];
    raw = await chatCompletion([{ role: 'user', content: parts }], { temperature: 0.2, maxTokens: 800 });
  } else {
    raw = await chatCompletion([{ role: 'user', content: prompt }], { temperature: 0.2, maxTokens: 800 });
  }

  const parsed = parseJsonResponse(raw);
  const score = Math.min(Math.max(typeof parsed?.score === 'number' ? parsed.score : 0, 0), maxMarks);
  const feedback = String(parsed?.feedback ?? 'Unable to provide feedback.');

  return { score, feedback };
}

// ─── Extract text from uploaded PDF for homework ────────────────────────────

export async function extractHomeworkPdfText(buffer: Buffer): Promise<string> {
  return extractTextFromPdfBuffer(buffer, 30);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseJsonResponse(raw: string): Record<string, unknown> | null {
  const cleaned = raw.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 5,
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
