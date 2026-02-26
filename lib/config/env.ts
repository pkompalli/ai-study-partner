export const env = {
  llm: {
    defaultModelId: process.env.LLM_MODEL_ID ?? 'azure/azure-gpt-4.1',
  },
  azure: {
    resourceName: process.env.AZURE_RESOURCE_NAME ?? '',
    apiKey: process.env.AZURE_API_KEY ?? '',
    apiVersion: process.env.AZURE_API_VERSION ?? 'preview',
    gpt41Deployment: process.env.AZURE_GPT_4_1_DEPLOYMENT ?? 'azure-gpt-4.1',
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    region: process.env.AWS_REGION ?? 'ap-south-1',
    bedrockModel: process.env.BEDROCK_MODEL ?? 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
  },
  google: {
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? '',
  },
}
