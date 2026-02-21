import type { Response } from 'express';
import { chatCompletion, chatCompletionStream } from './client.js';
import { buildSummaryProsePrompt, buildSummaryInteractivePrompt } from './prompts.js';

/**
 * Streams the topic summary prose via SSE, then generates starters and sends a done event.
 */
export interface SummaryInteractiveResult {
  question: string;
  answerPills: string[];
  starters: string[];
}

export async function streamTopicSummarySSE(
  res: Response,
  params: {
    courseName: string;
    topicName: string;
    chapterName?: string;
    yearOfStudy?: string;
    examName?: string;
    goal?: string;
    depth?: number;
  },
): Promise<SummaryInteractiveResult> {
  const prosePrompt = buildSummaryProsePrompt(
    params.topicName,
    params.chapterName,
    params.courseName,
    params.yearOfStudy,
    params.examName,
    params.goal,
    params.depth ?? 0,
  );

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Stream the prose summary
  for await (const chunk of chatCompletionStream([
    { role: 'system', content: prosePrompt },
    { role: 'user', content: 'Write the summary.' },
  ], { maxTokens: 1500 })) {
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
  }

  // Generate question + answerPills + starters non-streaming (fast, separate call)
  let question = '';
  let answerPills: string[] = [];
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
    ], { temperature: 0.5, maxTokens: 400 });
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    question = typeof parsed.question === 'string' ? parsed.question : '';
    answerPills = Array.isArray(parsed.answerPills) ? parsed.answerPills : [];
    starters = Array.isArray(parsed.starters) ? parsed.starters : [];
  } catch { /* fields remain empty */ }

  res.write(`data: ${JSON.stringify({ type: 'done', question, answerPills, starters })}\n\n`);
  res.end();
  return { question, answerPills, starters };
}
