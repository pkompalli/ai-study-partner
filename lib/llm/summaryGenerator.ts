import { chatCompletion, chatCompletionStream } from '@/lib/llm/client';
import { buildSummaryProsePrompt, buildSummaryInteractivePrompt } from '@/lib/llm/prompts';

export interface SummaryInteractiveResult {
  summary: string;
  question: string;
  answerPills: string[];
  correctIndex: number;
  explanation: string;
  starters: string[];
}

/**
 * Returns an async generator that yields SSE-formatted chunk data strings,
 * and resolves with the full SummaryInteractiveResult when done.
 *
 * Consumers should write `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`
 * for each yielded value, then write the done event with the return value.
 */
export async function* streamTopicSummaryGenerator(
  params: {
    courseName: string;
    topicName: string;
    chapterName?: string;
    yearOfStudy?: string;
    examName?: string;
    goal?: string;
    depth?: number;
  },
): AsyncGenerator<string, SummaryInteractiveResult, unknown> {
  const prosePrompt = buildSummaryProsePrompt(
    params.topicName,
    params.chapterName,
    params.courseName,
    params.yearOfStudy,
    params.examName,
    params.goal,
    params.depth ?? 0,
  );

  // Stream the prose summary
  let summaryAccumulated = '';
  for await (const chunk of chatCompletionStream([
    { role: 'system', content: prosePrompt },
    { role: 'user', content: 'Write the summary.' },
  ], { maxTokens: 1500 })) {
    summaryAccumulated += chunk;
    yield chunk;
  }

  // Generate question + answerPills + correctIndex + explanation + starters non-streaming (fast, separate call)
  let question = '';
  let answerPills: string[] = [];
  let correctIndex = -1;
  let explanation = '';
  let starters: string[] = [];
  try {
    const interactivePrompt = buildSummaryInteractivePrompt(
      params.topicName,
      params.chapterName,
      params.courseName,
      params.yearOfStudy,
    );
    const raw = await chatCompletion([
      { role: 'system', content: interactivePrompt },
      { role: 'user', content: 'Generate the interactive elements.' },
    ], { temperature: 0.5, maxTokens: 500 });
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    question = typeof parsed.question === 'string' ? parsed.question : '';
    answerPills = Array.isArray(parsed.answerPills) ? parsed.answerPills : [];
    correctIndex = typeof parsed.correctIndex === 'number' ? parsed.correctIndex : -1;
    explanation = typeof parsed.explanation === 'string' ? parsed.explanation : '';
    starters = Array.isArray(parsed.starters) ? parsed.starters : [];
  } catch { /* fields remain empty */ }

  return { summary: summaryAccumulated, question, answerPills, correctIndex, explanation, starters };
}
