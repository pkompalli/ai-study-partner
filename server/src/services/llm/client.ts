import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { openai, DEPLOYMENT } from '../../config/azureOpenAI.js';

export async function chatCompletion(
  messages: ChatCompletionMessageParam[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: DEPLOYMENT,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  });
  return response.choices[0]?.message?.content ?? '';
}

export async function* chatCompletionStream(
  messages: ChatCompletionMessageParam[],
  options?: { temperature?: number; maxTokens?: number }
): AsyncGenerator<string> {
  const stream = await openai.chat.completions.create({
    model: DEPLOYMENT,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}
