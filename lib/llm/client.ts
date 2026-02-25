import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { generateText, streamText } from 'ai'
import type { ModelMessage } from '@ai-sdk/provider-utils'
import { env } from '@/lib/config/env'

const bedrock = createAmazonBedrock({
  region: env.aws.region,
  accessKeyId: env.aws.accessKeyId,
  secretAccessKey: env.aws.secretAccessKey,
})

const MODEL = env.aws.bedrockModel

// Re-export as the name the rest of the codebase uses
export type { ModelMessage as ChatCompletionMessageParam }

export async function chatCompletion(
  messages: ModelMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const { text } = await generateText({
    model: bedrock(MODEL),
    messages,
    temperature: options?.temperature ?? 0.7,
    maxOutputTokens: options?.maxTokens ?? 2048,
  })
  return text
}

export async function* chatCompletionStream(
  messages: ModelMessage[],
  options?: { temperature?: number; maxTokens?: number }
): AsyncGenerator<string> {
  const { textStream } = streamText({
    model: bedrock(MODEL),
    messages,
    temperature: options?.temperature ?? 0.7,
    maxOutputTokens: options?.maxTokens ?? 2048,
  })
  for await (const chunk of textStream) {
    yield chunk
  }
}
