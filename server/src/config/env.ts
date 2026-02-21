import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3001'),
  JWT_SECRET: z.string().min(1).default('change-me-in-production'),
  DATABASE_PATH: z.string().default('./data/app.db'),
  UPLOADS_DIR: z.string().default('./uploads'),
  AZURE_OPENAI_ENDPOINT: z.string().optional().or(z.literal('')),
  AZURE_OPENAI_API_KEY: z.string().optional().or(z.literal('')),
  AZURE_OPENAI_DEPLOYMENT_NAME: z.string().default('gpt-4o'),
  AZURE_OPENAI_API_VERSION: z.string().default('2024-02-01'),
  YOUTUBE_API_KEY: z.string().optional().or(z.literal('')),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
