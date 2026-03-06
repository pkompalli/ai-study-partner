import type { ChatCompletionMessageParam } from '@/lib/llm/client';
import { chatCompletionStream, chatCompletion } from '@/lib/llm/client';
import { buildStudyMateSystemPrompt } from '@/lib/llm/prompts';
import { analyzeImageNeeds, buildImageDirective, insertMissingImages, type ImageNeedsResult } from '@/lib/images/needsAnalyzer';
import type { SessionMessage } from '@/types';

const MAX_RECENT_MESSAGES = 15;

/**
 * Returns an async generator that yields SSE-formatted string chunks,
 * and resolves with the full accumulated content when done.
 */
export async function* streamStudyMateResponseGenerator(
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
  // Analyze whether this topic needs images (runs in parallel with prompt build)
  let imageNeeds: ImageNeedsResult = { needsImages: false, imageNeeds: [], domainHint: null };
  try {
    imageNeeds = await analyzeImageNeeds(
      context.topicName,
      context.chapterName,
      context.courseName,
      context.depth ?? 3,
    );
  } catch { /* proceed without images */ }

  const systemPrompt = buildStudyMateSystemPrompt(
    context.courseName,
    context.topicName,
    context.chapterName,
    context.goal,
    context.yearOfStudy,
    context.examName,
    context.depth,
  );

  // Append image directive if the analyzer determined images are needed
  const imageDirective = buildImageDirective(imageNeeds);
  const fullSystemPrompt = imageDirective
    ? `${systemPrompt}\n\n${imageDirective}`
    : systemPrompt;

  const recentHistory = history.slice(-MAX_RECENT_MESSAGES);
  const hasOlderMessages = history.length > MAX_RECENT_MESSAGES;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: fullSystemPrompt },
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

  // Post-generation: if the LLM didn't include required images, append them
  if (imageNeeds.needsImages) {
    const patched = insertMissingImages(fullContent, imageNeeds);
    if (patched.length > fullContent.length) {
      const appended = patched.slice(fullContent.length);
      fullContent = patched;
      yield appended;
    }
  }

  return fullContent;
}

async function summariseOlderMessages(messages: SessionMessage[]): Promise<string> {
  const transcript = messages
    .map(m => `${m.role === 'user' ? 'Student' : 'Study Mate'}: ${m.content}`)
    .join('\n');

  return chatCompletion([
    {
      role: 'system',
      content: "Summarise this study conversation in 3–5 sentences, capturing key concepts covered and the student's understanding level.",
    },
    { role: 'user', content: transcript.slice(0, 8000) },
  ], { temperature: 0.3, maxTokens: 512 });
}
