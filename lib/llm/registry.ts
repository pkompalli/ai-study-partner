import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAzure } from '@ai-sdk/azure'
import type { LanguageModel } from 'ai'
import { env } from '@/lib/config/env'

export const MODEL_IDS = {
  AZURE_GPT_4_1: 'azure/azure-gpt-4.1',
  OPENAI_GPT_4_1: 'openai/gpt-4.1',
  GOOGLE_GEMINI_3_FLASH: 'google/gemini-3-flash-preview',
  BEDROCK_CLAUDE_SONNET_4_5: 'bedrock/claude-sonnet-4-5',
} as const

export type ModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS]

const openai = createOpenAI({
  apiKey: env.openai.apiKey,
})

const google = createGoogleGenerativeAI({
  apiKey: env.google.apiKey,
})

const azure = createAzure({
  resourceName: env.azure.resourceName || undefined,
  apiKey: env.azure.apiKey || undefined,
  apiVersion: env.azure.apiVersion || undefined,
  useDeploymentBasedUrls: true,
})

const bedrock = createAmazonBedrock({
  region: env.aws.region,
  accessKeyId: env.aws.accessKeyId,
  secretAccessKey: env.aws.secretAccessKey,
})

const factories: Record<ModelId, () => LanguageModel> = {
  [MODEL_IDS.AZURE_GPT_4_1]: () => azure.chat(env.azure.gpt41Deployment),
  [MODEL_IDS.OPENAI_GPT_4_1]: () => openai.chat('gpt-4.1'),
  [MODEL_IDS.GOOGLE_GEMINI_3_FLASH]: () => google.chat('gemini-3-flash-preview'),
  [MODEL_IDS.BEDROCK_CLAUDE_SONNET_4_5]: () => bedrock(env.aws.bedrockModel),
}

const defaultModelId: ModelId =
  (Object.values(MODEL_IDS) as string[]).includes(env.llm.defaultModelId)
    ? (env.llm.defaultModelId as ModelId)
    : MODEL_IDS.AZURE_GPT_4_1

export function resolveModel(modelId?: ModelId): LanguageModel {
  const selected = modelId ?? defaultModelId
  return factories[selected]()
}

export function getDefaultModelId(): ModelId {
  return defaultModelId
}
