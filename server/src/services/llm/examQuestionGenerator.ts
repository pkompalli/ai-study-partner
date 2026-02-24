import { chatCompletion } from './client.js';
import { buildExamFormatInferPrompt, buildExamQuestionPrompt } from './examPrompts.js';
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
}): Promise<GeneratedQuestion[]> {
  const { sections, topics, courseName, examName, yearOfStudy } = params;
  if (topics.length === 0 || sections.length === 0) return [];

  const level = inferAcademicLevel(yearOfStudy, courseName);

  const tasks: Array<() => Promise<GeneratedQuestion | null>> = [];

  for (const section of sections) {
    // Track questions already queued for this section (to avoid duplicates)
    const existingQuestionsForSection: string[] = [];
    const defaultMarks = section.marks_per_question
      ?? (section.total_marks ? Math.round(section.total_marks / section.num_questions) : 1);

    for (let qi = 0; qi < section.num_questions; qi++) {
      // Round-robin across topics
      const topic = topics[qi % topics.length];
      const capturedExisting = [...existingQuestionsForSection];

      const task = async (): Promise<GeneratedQuestion | null> => {
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
        });

        const raw = await chatCompletion(
          [{ role: 'user', content: prompt }],
          { temperature: 0.85, maxTokens: getMaxTokensForType(section.question_type) },
        );

        return parseGeneratedQuestion(raw, section, topic.id, defaultMarks);
      };

      tasks.push(task);
      // Add a placeholder so future tasks in the same section know about this slot
      existingQuestionsForSection.push(`[question ${qi + 1} for ${topic.name}]`);
    }
  }

  const results = await runWithConcurrency(tasks, 8);
  return results.filter((r): r is GeneratedQuestion => r !== null);
}
