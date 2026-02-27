import { generateText, streamText } from 'ai'
import type { ModelMessage } from 'ai'
import { resolveModel, type ModelId } from '@/lib/llm/registry'

// Re-export as the name the rest of the codebase uses
export type { ModelMessage as ChatCompletionMessageParam }

export async function chatCompletion(
  messages: ModelMessage[],
  options?: { temperature?: number; maxTokens?: number; modelId?: ModelId }
): Promise<string> {
  const { text } = await generateText({
    model: resolveModel(options?.modelId),
    messages,
    temperature: options?.temperature ?? 0.7,
    maxOutputTokens: options?.maxTokens ?? 2048,
  })
  return text
}

export async function* chatCompletionStream(
  messages: ModelMessage[],
  options?: { temperature?: number; maxTokens?: number; modelId?: ModelId }
): AsyncGenerator<string> {
  const { textStream } = streamText({
    model: resolveModel(options?.modelId),
    messages,
    temperature: options?.temperature ?? 0.7,
    maxOutputTokens: options?.maxTokens ?? 2048,
  })
  for await (const chunk of textStream) {
    yield chunk
  }
}
