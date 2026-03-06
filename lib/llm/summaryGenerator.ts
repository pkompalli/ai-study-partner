import { chatCompletion, chatCompletionStream } from '@/lib/llm/client';
import { buildSummaryProsePrompt, buildSummaryInteractivePrompt } from '@/lib/llm/prompts';
import { analyzeImageNeeds, buildImageDirective, insertMissingImages, type ImageNeedsResult } from '@/lib/images/needsAnalyzer';

export interface SummaryQuestion {
  question: string;
  answerPills: string[];
  correctIndex: number;
  explanation: string;
}

export interface SummaryInteractiveResult {
  summary: string;
  questions: SummaryQuestion[];
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
  const depth = params.depth ?? 0;

  // Analyze whether this topic needs images
  let imageNeeds: ImageNeedsResult = { needsImages: false, imageNeeds: [], domainHint: null };
  try {
    imageNeeds = await analyzeImageNeeds(
      params.topicName,
      params.chapterName,
      params.courseName,
      depth,
    );
  } catch { /* proceed without images */ }

  const prosePrompt = buildSummaryProsePrompt(
    params.topicName,
    params.chapterName,
    params.courseName,
    params.yearOfStudy,
    params.examName,
    params.goal,
    depth,
  );

  // Append image directive if needed
  const imageDirective = buildImageDirective(imageNeeds);
  const fullProsePrompt = imageDirective
    ? `${prosePrompt}\n\n${imageDirective}`
    : prosePrompt;

  // Scale token budget by depth so deeper summaries aren't truncated
  const proseTokenLimit = depth <= 1 ? 1500 : depth === 2 ? 2000 : depth === 3 ? 3500 : depth === 4 ? 5000 : 7000;

  // Stream the prose summary
  let summaryAccumulated = '';
  for await (const chunk of chatCompletionStream([
    { role: 'system', content: fullProsePrompt },
    { role: 'user', content: 'Write the summary.' },
  ], { maxTokens: proseTokenLimit })) {
    summaryAccumulated += chunk;
    yield chunk;
  }

  // Post-generation: insert missing images if needed
  if (imageNeeds.needsImages) {
    const patched = insertMissingImages(summaryAccumulated, imageNeeds);
    if (patched.length > summaryAccumulated.length) {
      const appended = patched.slice(summaryAccumulated.length);
      summaryAccumulated = patched;
      yield appended;
    }
  }

  // Generate comprehension questions + starters non-streaming (fast, separate call)
  let questions: SummaryQuestion[] = [];
  let starters: string[] = [];
  try {
    const interactivePrompt = buildSummaryInteractivePrompt(
      params.topicName,
      params.chapterName,
      params.courseName,
      params.yearOfStudy,
      summaryAccumulated,
      params.depth,
    );
    const raw = await chatCompletion([
      { role: 'system', content: interactivePrompt },
      { role: 'user', content: 'Generate the comprehension questions and exploration suggestions.' },
    ], { temperature: 0.5, maxTokens: 1500 });
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Parse questions array (new multi-question format)
    if (Array.isArray(parsed.questions)) {
      for (const q of parsed.questions) {
        if (q && typeof q.question === 'string' && Array.isArray(q.answerPills)) {
          questions.push({
            question: q.question,
            answerPills: q.answerPills,
            correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : -1,
            explanation: typeof q.explanation === 'string' ? q.explanation : '',
          });
        }
      }
    }
    // Fallback: old single-question format
    if (questions.length === 0 && typeof parsed.question === 'string') {
      questions.push({
        question: parsed.question,
        answerPills: Array.isArray(parsed.answerPills) ? parsed.answerPills : [],
        correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : -1,
        explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
      });
    }

    starters = Array.isArray(parsed.starters) ? parsed.starters : [];
  } catch { /* fields remain empty */ }

  return { summary: summaryAccumulated, questions, starters };
}
