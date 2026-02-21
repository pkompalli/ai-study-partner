import { chatCompletion } from './client.js';
import { FLASHCARD_GENERATOR_PROMPT } from './prompts.js';
import type { Flashcard, SessionMessage } from '../../types/index.js';

export async function generateFlashcards(
  topicName: string,
  recentMessages: SessionMessage[],
  existingFronts: string[] = [],
): Promise<Flashcard[]> {
  const context = recentMessages
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
    .join('\n');

  const dedupNote = existingFronts.length > 0
    ? `\n\nThe student already has these cards — do NOT duplicate them, generate only NEW concepts:\n${existingFronts.map(f => `- ${f}`).join('\n')}`
    : '';

  const response = await chatCompletion([
    { role: 'system', content: FLASHCARD_GENERATOR_PROMPT },
    {
      role: 'user',
      content: `Topic: "${topicName}"\n\nRecent conversation context:\n${context}${dedupNote}\n\nGenerate flashcards.`,
    },
  ], { temperature: 0.6 });

  const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return parsed.cards as Flashcard[];
}
