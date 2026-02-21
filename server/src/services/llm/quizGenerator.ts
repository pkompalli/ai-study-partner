import { chatCompletion } from './client.js';
import { QUIZ_GENERATOR_PROMPT } from './prompts.js';
import type { QuizQuestion, SessionMessage } from '../../types/index.js';

export async function generateQuiz(
  topicName: string,
  recentMessages: SessionMessage[]
): Promise<QuizQuestion[]> {
  const context = recentMessages
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n');

  const response = await chatCompletion([
    { role: 'system', content: QUIZ_GENERATOR_PROMPT },
    {
      role: 'user',
      content: `Topic: "${topicName}"\n\nRecent conversation context:\n${context}\n\nGenerate a 5-question quiz.`,
    },
  ], { temperature: 0.5 });

  const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return parsed.questions as QuizQuestion[];
}

export function scoreQuiz(
  questions: QuizQuestion[],
  answers: Record<string, number>
): { score: number; total: number; results: Array<{ id: string; correct: boolean; explanation: string }> } {
  let score = 0;
  const results = questions.map(q => {
    const userAnswer = answers[q.id];
    const correct = userAnswer === q.correctIndex;
    if (correct) score++;
    return { id: q.id, correct, explanation: q.explanation };
  });
  return { score, total: questions.length, results };
}
