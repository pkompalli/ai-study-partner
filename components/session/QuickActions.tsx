'use client'
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
  { label: 'Quiz', icon: <Brain className="h-4 w-4" />, key: 'quiz' as const, color: 'text-gray-600 hover:text-primary-600 hover:bg-primary-50' },
  { label: 'Cards', icon: <CreditCard className="h-4 w-4" />, key: 'flashcards' as const, color: 'text-gray-600 hover:text-primary-600 hover:bg-primary-50' },
  { label: 'Videos', icon: <Youtube className="h-4 w-4" />, key: 'videos' as const, color: 'text-gray-600 hover:text-primary-600 hover:bg-primary-50' },
  { label: 'End', icon: <Square className="h-4 w-4" />, key: 'end' as const, color: 'text-gray-600 hover:text-primary-600 hover:bg-primary-50' },
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
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors',
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
