import type { Response } from 'express';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { chatCompletionStream, chatCompletion } from './client.js';
import { buildTutorSystemPrompt } from './prompts.js';
import type { SessionMessage } from '../../types/index.js';

const MAX_RECENT_MESSAGES = 15;

/**
 * Streams a tutor response via SSE.
 * Returns the full accumulated content when done.
 */
export async function streamTutorResponse(
  res: Response,
  userMessage: string,
  history: SessionMessage[],
  context: {
    courseName: string;
    topicName: string;
    chapterName?: string;
    goal?: string;
    yearOfStudy?: string;
    examName?: string;
    depth?: number;
  }
): Promise<string> {
  const systemPrompt = buildTutorSystemPrompt(
    context.courseName,
    context.topicName,
    context.chapterName,
    context.goal,
    context.yearOfStudy,
    context.examName,
    context.depth,
  );

  const recentHistory = history.slice(-MAX_RECENT_MESSAGES);
  const hasOlderMessages = history.length > MAX_RECENT_MESSAGES;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (hasOlderMessages) {
    const olderMessages = history.slice(0, -MAX_RECENT_MESSAGES);
    const summary = await summariseOlderMessages(olderMessages);
    messages.push({ role: 'system', content: `Earlier conversation summary:\n${summary}` });
  }

  for (const msg of recentHistory) {
    if (msg.role === 'system') continue;
    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
  }
  messages.push({ role: 'user', content: userMessage });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let fullContent = '';
  for await (const chunk of chatCompletionStream(messages)) {
    fullContent += chunk;
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
  }

  return fullContent;
}

async function summariseOlderMessages(messages: SessionMessage[]): Promise<string> {
  const transcript = messages
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n');

  return chatCompletion([
    {
      role: 'system',
      content: "Summarise this tutoring conversation in 3–5 sentences, capturing key concepts covered and the student's understanding level.",
    },
    { role: 'user', content: transcript.slice(0, 8000) },
  ], { temperature: 0.3, maxTokens: 512 });
}
