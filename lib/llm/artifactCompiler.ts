import { chatCompletion } from '@/lib/llm/client';
import { ARTIFACT_COMPILER_PROMPT } from '@/lib/llm/prompts';
import type { SessionMessage, QuizQuestion, Flashcard } from '@/types';

interface ArtifactInput {
  courseName: string;
  topicName: string;
  chapterName?: string;
  messages: SessionMessage[];
  quizQuestions?: QuizQuestion[];
  quizAnswers?: { score: number; total: number };
  flashcards?: Flashcard[];
}

export async function compileArtifact(input: ArtifactInput): Promise<string> {
  const transcript = input.messages
    .filter(m => m.role !== 'system')
    .map(m => `**${m.role === 'user' ? 'Student' : 'Tutor'}**: ${m.content}`)
    .join('\n\n');

  const quizSection = input.quizQuestions
    ? `\n\nQuiz: ${input.quizAnswers?.score ?? 0}/${input.quizAnswers?.total ?? input.quizQuestions.length} correct\n${
        input.quizQuestions.map(q => `- Q: ${q.question}\n  Correct: ${q.options[q.correctIndex]}\n  ${q.explanation}`).join('\n')
      }`
    : '';

  const flashcardSection = input.flashcards
    ? `\n\nFlashcards covered:\n${input.flashcards.map(f => `- **${f.front}**: ${f.back}`).join('\n')}`
    : '';

  const userContent = `Course: "${input.courseName}"
Topic: "${input.topicName}"${input.chapterName ? `\nChapter: "${input.chapterName}"` : ''}

Session Transcript:
${transcript.slice(0, 10000)}
${quizSection}
${flashcardSection}

Compile a comprehensive lesson artifact.`;

  return chatCompletion([
    { role: 'system', content: ARTIFACT_COMPILER_PROMPT },
    { role: 'user', content: userContent },
  ], { temperature: 0.4, maxTokens: 3000 });
}
