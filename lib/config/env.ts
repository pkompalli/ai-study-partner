export const env = {
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
    apiKey: process.env.AZURE_OPENAI_API_KEY ?? '',
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt-4o',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-02-01',
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? '',
  },
}
