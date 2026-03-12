import { chatCompletion } from '@/lib/llm/client';
import { buildFlashcardPrompt } from '@/lib/llm/prompts';
import type { Flashcard, SessionMessage } from '@/types';

export async function generateFlashcards(
  topicName: string,
  recentMessages: SessionMessage[],
  existingFronts: string[] = [],
  chapterName?: string,
): Promise<Flashcard[]> {
  const context = recentMessages
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Student' : 'Study Mate'}: ${m.content}`)
    .join('\n');

  const scopeLabel = chapterName ? `${topicName} > ${chapterName}` : topicName;

  const dedupNote = existingFronts.length > 0
    ? `\n\nThe student already has these cards — do NOT duplicate them, generate only NEW concepts:\n${existingFronts.map(f => `- ${f}`).join('\n')}`
    : '';

  const response = await chatCompletion([
    { role: 'system', content: buildFlashcardPrompt(topicName, chapterName) },
    {
      role: 'user',
      content: `Topic: "${scopeLabel}"\n\nRecent conversation context:\n${context}${dedupNote}\n\nGenerate flashcards.`,
    },
  ], { temperature: 0.6 });

  const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return parsed.cards as Flashcard[];
}
