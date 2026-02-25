import { chatCompletion } from '@/lib/llm/client';
import { buildMarkingPrompt, buildHintPrompt, buildFullAnswerPrompt } from '@/lib/llm/examPrompts';
import type { MarkCriterion } from '@/types';

export interface MarkResult {
  score: number;
  feedback: string;
}

export async function markAnswer(params: {
  questionText: string;
  questionType: string;
  dataset?: string;
  markScheme: MarkCriterion[];
  maxMarks: number;
  studentAnswer: string;
  customRubric?: string;
  // MCQ-specific: skip LLM if type is mcq
  correctOptionIndex?: number;
  selectedOptionIndex?: number;
  // Vision: images uploaded by student as their written answer
  images?: { base64: string; mimeType: string }[];
}): Promise<MarkResult> {
  // MCQ: no LLM needed — just compare indices
  if (params.questionType === 'mcq') {
    const correct = typeof params.selectedOptionIndex === 'number'
      && params.selectedOptionIndex === params.correctOptionIndex;
    return {
      score: correct ? params.maxMarks : 0,
      feedback: correct
        ? `Correct! Option ${(params.correctOptionIndex ?? 0) + 1} is right.`
        : `Incorrect. The correct answer was option ${(params.correctOptionIndex ?? 0) + 1}.`,
    };
  }

  const prompt = buildMarkingPrompt({
    questionText: params.questionText,
    questionType: params.questionType,
    dataset: params.dataset,
    markScheme: params.markScheme,
    maxMarks: params.maxMarks,
    studentAnswer: params.studentAnswer,
    customRubric: params.customRubric,
  });

  // Build message content — include uploaded images if present
  const messageContent = params.images?.length
    ? [
        { type: 'text' as const, text: prompt },
        ...params.images.map(img => ({
          type: 'image' as const,
          image: img.base64,
          mimeType: img.mimeType,
        })),
      ]
    : prompt;

  const raw = await chatCompletion(
    [{ role: 'user', content: messageContent }],
    { temperature: 0.2, maxTokens: 800 },
  );

  let parsed: { score: number; feedback: string };
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { score: 0, feedback: 'Unable to mark answer automatically. Please self-assess.' };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { score: 0, feedback: 'Unable to mark answer automatically. Please self-assess.' };
    }
  }

  return {
    score: Math.min(
      Math.max(typeof parsed.score === 'number' ? parsed.score : 0, 0),
      params.maxMarks,
    ),
    feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
  };
}

export async function getHint(params: {
  questionText: string;
  questionType: string;
  dataset?: string;
  studentAnswer?: string;
  hintsUsed: number;
}): Promise<string> {
  const prompt = buildHintPrompt(params);

  const hint = await chatCompletion(
    [{ role: 'user', content: prompt }],
    { temperature: 0.6, maxTokens: 250 },
  );

  return hint.trim();
}

export async function getFullAnswer(params: {
  questionText: string;
  questionType: string;
  dataset?: string;
  markScheme: MarkCriterion[];
  maxMarks: number;
}): Promise<string> {
  const prompt = buildFullAnswerPrompt(params);

  const answer = await chatCompletion(
    [{ role: 'user', content: prompt }],
    { temperature: 0.3, maxTokens: 1400 },
  );

  return answer.trim();
}
