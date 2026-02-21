import { Brain, CreditCard, Youtube, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
  onQuiz: () => void;
  onFlashcards: () => void;
  onVideos: () => void;
  onEnd: () => void;
  disabled?: boolean;
}

const actions = [
  { label: 'Quiz', icon: <Brain className="h-4 w-4" />, key: 'quiz' as const, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
  { label: 'Cards', icon: <CreditCard className="h-4 w-4" />, key: 'flashcards' as const, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
  { label: 'Videos', icon: <Youtube className="h-4 w-4" />, key: 'videos' as const, color: 'text-red-600 bg-red-50 hover:bg-red-100' },
  { label: 'End', icon: <Square className="h-4 w-4" />, key: 'end' as const, color: 'text-gray-600 bg-gray-50 hover:bg-gray-100' },
];

export function QuickActions({ onQuiz, onFlashcards, onVideos, onEnd, disabled }: QuickActionsProps) {
  const handlers = { quiz: onQuiz, flashcards: onFlashcards, videos: onVideos, end: onEnd };

  return (
    <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
      {actions.map(action => (
        <button
          key={action.key}
          onClick={handlers[action.key]}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            action.color
          )}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}
