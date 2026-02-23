import { chatCompletion } from './client.js';
import { buildPillsPrompt } from './prompts.js';

export async function generateResponsePills(
  aiResponse: string,
  topicName: string,
  levelLabel: string,
): Promise<{ question: string; answerPills: string[]; correctIndex: number; explanation: string; followupPills: string[] }> {
  const prompt = buildPillsPrompt(aiResponse, topicName, levelLabel);

  const raw = await chatCompletion([
    { role: 'system', content: prompt },
    { role: 'user', content: 'Generate the question, answer pills, and followup pills.' },
  ], { temperature: 0.4, maxTokens: 500 });

  try {
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    return {
      question: typeof parsed.question === 'string' ? parsed.question : '',
      answerPills: Array.isArray(parsed.answerPills) ? parsed.answerPills : [],
      correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : -1,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
      followupPills: Array.isArray(parsed.followupPills) ? parsed.followupPills : [],
    };
  } catch {
    return { question: '', answerPills: [], correctIndex: -1, explanation: '', followupPills: [] };
  }
}
