import { generateObject } from 'ai';
import { chatCompletion } from '@/lib/llm/client';
import { buildPillsPrompt } from '@/lib/llm/prompts';
import { MODEL_IDS, resolveModel } from '@/lib/llm/registry';
import { z } from 'zod';

type PillsResult = {
  question: string;
  answerPills: string[];
  correctIndex: number;
  explanation: string;
  followupPills: string[];
}

const stringArraySchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.replace(/^[\-\d.)\s]+/, '').trim())
      .filter(Boolean);
  }
  return [];
}, z.array(z.string()));

const pillsObjectSchema = z.object({
  question: z.string().optional(),
  mcqQuestion: z.string().optional(),
  answerPills: stringArraySchema.optional(),
  answer_pills: stringArraySchema.optional(),
  options: stringArraySchema.optional(),
  answerOptions: stringArraySchema.optional(),
  answer_options: stringArraySchema.optional(),
  correctIndex: z.union([z.number(), z.string()]).optional(),
  correct_index: z.union([z.number(), z.string()]).optional(),
  explanation: z.string().optional(),
  followupPills: stringArraySchema.optional(),
  followup_pills: stringArraySchema.optional(),
  followUpPills: stringArraySchema.optional(),
  follow_up_pills: stringArraySchema.optional(),
  starters: stringArraySchema.optional(),
}).transform((parsed): PillsResult => {
  const question = parsed.question ?? parsed.mcqQuestion ?? '';
  const answerPills = (
    parsed.answerPills ??
    parsed.answer_pills ??
    parsed.options ??
    parsed.answerOptions ??
    parsed.answer_options ??
    []
  ).slice(0, 4);

  const rawCorrect = parsed.correctIndex ?? parsed.correct_index;
  const normalizedCorrect = typeof rawCorrect === 'number'
    ? rawCorrect
    : Number.isFinite(Number(rawCorrect)) ? Number(rawCorrect) : -1;

  const followupPills =
    parsed.followupPills ??
    parsed.followup_pills ??
    parsed.followUpPills ??
    parsed.follow_up_pills ??
    parsed.starters ??
    [];

  return {
    question,
    answerPills,
    correctIndex: normalizedCorrect >= 0 && normalizedCorrect < answerPills.length ? normalizedCorrect : -1,
    explanation: parsed.explanation ?? '',
    followupPills,
  };
});

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

  try {
    const { object } = await generateObject({
      model: resolveModel(MODEL_IDS.GOOGLE_GEMINI_3_FLASH),
      schema: pillsObjectSchema,
      schemaName: 'response_pills',
      schemaDescription: 'Comprehension MCQ pills and follow-up exploration pills',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Generate the question, answer pills, and followup pills.' },
      ],
      temperature: 0.4,
      maxOutputTokens: 500,
    });
    return object;
  } catch {
    // Fallback keeps pills flowing even if structured generation fails for a response.
    const raw = await chatCompletion([
      { role: 'system', content: prompt },
      { role: 'user', content: 'Generate the question, answer pills, and followup pills.' },
    ], { temperature: 0.4, maxTokens: 500, modelId: MODEL_IDS.GOOGLE_GEMINI_3_FLASH });
    return parsePillsPayload(raw);
  }
}
