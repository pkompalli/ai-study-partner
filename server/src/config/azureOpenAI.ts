import OpenAI from 'openai';
import { env } from './env.js';

export const openai = new OpenAI({
  apiKey: env.AZURE_OPENAI_API_KEY,
  baseURL: `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': env.AZURE_OPENAI_API_VERSION },
  defaultHeaders: { 'api-key': env.AZURE_OPENAI_API_KEY },
});

export const DEPLOYMENT = env.AZURE_OPENAI_DEPLOYMENT_NAME;
