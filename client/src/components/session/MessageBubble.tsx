import { cn } from '@/lib/utils';
import type { SessionMessage } from '@/types';
import { ExternalLink } from 'lucide-react';
import { RichMessageContent } from './RichMessageContent';

interface MessageBubbleProps {
  message: SessionMessage;
}

interface QuizMeta { questions: { id: string }[] }
interface FlashcardMeta { cards: { id: string }[] }
interface VideoMeta { videos: { title: string; url: string; channelTitle: string }[] }

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0 mt-1">
          AI
        </div>
      )}

      <div className={cn(
        'flex-1 min-w-0 rounded-2xl px-4 py-3',
        isUser ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white border border-gray-100 text-gray-900 rounded-bl-md shadow-sm'
      )}>
        {message.content_type === 'text' && (
          <RichMessageContent content={message.content} invert={isUser} />
        )}

        {message.content_type === 'quiz' && (
          <div>
            <p className="font-medium text-sm mb-2">📝 Quiz generated!</p>
            <p className="text-xs text-gray-500">
              {((message.metadata as QuizMeta | undefined)?.questions?.length ?? 0)} questions ready
            </p>
          </div>
        )}

        {message.content_type === 'flashcards' && (
          <div>
            <p className="font-medium text-sm mb-2">🃏 Flashcards generated!</p>
            <p className="text-xs text-gray-500">
              {((message.metadata as FlashcardMeta | undefined)?.cards?.length ?? 0)} cards ready
            </p>
          </div>
        )}

        {message.content_type === 'videos' && (
          <div>
            <p className="font-medium text-sm mb-2">🎬 Video links</p>
            <div className="space-y-1">
              {((message.metadata as VideoMeta | undefined)?.videos ?? []).slice(0, 3).map((v, i) => (
                <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 text-xs text-primary-600 hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  <span className="line-clamp-1">{v.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
