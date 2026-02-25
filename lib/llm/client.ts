import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { env } from '@/lib/config/env';

const openai = new OpenAI({
  apiKey: env.azureOpenAI.apiKey,
  baseURL: `${env.azureOpenAI.endpoint}/openai/deployments/${env.azureOpenAI.deploymentName}`,
  defaultQuery: { 'api-version': env.azureOpenAI.apiVersion },
  defaultHeaders: { 'api-key': env.azureOpenAI.apiKey },
});

const DEPLOYMENT = env.azureOpenAI.deploymentName;

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
