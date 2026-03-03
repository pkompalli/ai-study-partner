import { chatCompletion } from '@/lib/llm/client';
import { buildPillsPrompt } from '@/lib/llm/prompts';

type PillQuestion = {
  question: string;
  answerPills: string[];
  correctIndex: number;
  explanation: string;
}

type PillsResult = {
  questions: PillQuestion[];
  followupPills: string[];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    // Fallback for models that emit one suggestion per line as a string blob.
    return value
      .split('\n')
      .map((line) => line.replace(/^[\-\d.)\s]+/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function parseOneQuestion(obj: Record<string, unknown>): PillQuestion | null {
  const question = typeof obj.question === 'string'
    ? obj.question
    : (typeof obj.mcqQuestion === 'string' ? obj.mcqQuestion : '');

  if (!question) return null;

  const answerPillsRaw =
    obj.answerPills ??
    obj.answer_pills ??
    obj.options ??
    obj.answerOptions ??
    obj.answer_options;
  const answerPills = toStringArray(answerPillsRaw).slice(0, 4);

  const correctIndexRaw = obj.correctIndex ?? obj.correct_index;
  const correctIndex = typeof correctIndexRaw === 'number'
    ? correctIndexRaw
    : Number.isFinite(Number(correctIndexRaw)) ? Number(correctIndexRaw) : -1;

  const explanation = typeof obj.explanation === 'string' ? obj.explanation : '';

  return {
    question,
    answerPills,
    correctIndex: correctIndex >= 0 && correctIndex < answerPills.length ? correctIndex : -1,
    explanation,
  };
}

function parsePillsPayload(raw: string): PillsResult {
  const trimmed = raw.trim();
  const deFenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const candidates = [deFenced];
  const objectMatch = deFenced.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  let parsed: Record<string, unknown> | null = null;
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch {
      // try next candidate
    }
  }

  if (!parsed) {
    return { questions: [], followupPills: [] };
  }

  // Parse questions array (new multi-question format)
  const questions: PillQuestion[] = [];
  const questionsRaw = parsed.questions;
  if (Array.isArray(questionsRaw)) {
    for (const q of questionsRaw) {
      if (q && typeof q === 'object') {
        const pq = parseOneQuestion(q as Record<string, unknown>);
        if (pq) questions.push(pq);
      }
    }
  }

  // Fallback: old single-question format
  if (questions.length === 0) {
    const single = parseOneQuestion(parsed);
    if (single) questions.push(single);
  }

  const followupRaw =
    parsed.followupPills ??
    parsed.followup_pills ??
    parsed.followUpPills ??
    parsed.follow_up_pills ??
    parsed.starters;
  const followupPills = toStringArray(followupRaw);

  return { questions, followupPills };
}

export async function generateResponsePills(
  aiResponse: string,
  topicName: string,
  levelLabel: string,
): Promise<PillsResult> {
  const prompt = buildPillsPrompt(aiResponse, topicName, levelLabel);

  const raw = await chatCompletion([
    { role: 'system', content: prompt },
    { role: 'user', content: 'Generate the comprehension questions, answer pills, and followup pills.' },
  ], { temperature: 0.4, maxTokens: 1500 });

  return parsePillsPayload(raw);
}
