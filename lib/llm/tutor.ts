import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { chatCompletionStream, chatCompletion } from '@/lib/llm/client';
import { buildTutorSystemPrompt } from '@/lib/llm/prompts';
import type { SessionMessage } from '@/types';

const MAX_RECENT_MESSAGES = 15;

/**
 * Returns an async generator that yields SSE-formatted string chunks,
 * and resolves with the full accumulated content when done.
 */
export async function* streamTutorResponseGenerator(
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
): AsyncGenerator<string, string, unknown> {
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

  let fullContent = '';
  for await (const chunk of chatCompletionStream(messages)) {
    fullContent += chunk;
    yield chunk;
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
