export const env = {
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    region: process.env.AWS_REGION ?? 'ap-south-1',
    bedrockModel: process.env.BEDROCK_MODEL ?? 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? '',
  },
}
