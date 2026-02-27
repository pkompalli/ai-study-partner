import { chatCompletion } from '@/lib/llm/client';
import { buildPillsPrompt } from '@/lib/llm/prompts';

type PillsResult = {
  question: string;
  answerPills: string[];
  correctIndex: number;
  explanation: string;
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
    return { question: '', answerPills: [], correctIndex: -1, explanation: '', followupPills: [] };
  }

  const question = typeof parsed.question === 'string'
    ? parsed.question
    : (typeof parsed.mcqQuestion === 'string' ? parsed.mcqQuestion : '');

  const answerPillsRaw =
    parsed.answerPills ??
    parsed.answer_pills ??
    parsed.options ??
    parsed.answerOptions ??
    parsed.answer_options;
  const answerPills = toStringArray(answerPillsRaw).slice(0, 4);

  const correctIndexRaw = parsed.correctIndex ?? parsed.correct_index;
  const correctIndex = typeof correctIndexRaw === 'number'
    ? correctIndexRaw
    : Number.isFinite(Number(correctIndexRaw)) ? Number(correctIndexRaw) : -1;

  const explanation = typeof parsed.explanation === 'string' ? parsed.explanation : '';

  const followupRaw =
    parsed.followupPills ??
    parsed.followup_pills ??
    parsed.followUpPills ??
    parsed.follow_up_pills ??
    parsed.starters;
  const followupPills = toStringArray(followupRaw);

  return {
    question,
    answerPills,
    correctIndex: correctIndex >= 0 && correctIndex < answerPills.length ? correctIndex : -1,
    explanation,
    followupPills,
  };
}

export async function generateResponsePills(
  aiResponse: string,
  topicName: string,
  levelLabel: string,
): Promise<{ question: string; answerPills: string[]; correctIndex: number; explanation: string; followupPills: string[] }> {
  const prompt = buildPillsPrompt(aiResponse, topicName, levelLabel);

  const raw = await chatCompletion([
    { role: 'system', content: prompt },
    { role: 'user', content: 'Generate the question, answer pills, and followup pills.' },
  ], { temperature: 0.4, maxTokens: 500 });

  return parsePillsPayload(raw);
}
