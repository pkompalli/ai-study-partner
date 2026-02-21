import { chatCompletion } from './client.js';
import { buildPillsPrompt } from './prompts.js';

export interface CheckQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export async function generateResponsePills(
  aiResponse: string,
  topicName: string,
  levelLabel: string,
): Promise<{ questions: CheckQuestion[]; followupPills: string[] }> {
  const prompt = buildPillsPrompt(aiResponse, topicName, levelLabel);

  const raw = await chatCompletion([
    { role: 'system', content: prompt },
    { role: 'user', content: 'Generate the questions and followup pills.' },
  ], { temperature: 0.4, maxTokens: 700 });

  try {
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    return {
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      followupPills: Array.isArray(parsed.followupPills) ? parsed.followupPills : [],
    };
  } catch {
    return { questions: [], followupPills: [] };
  }
}
