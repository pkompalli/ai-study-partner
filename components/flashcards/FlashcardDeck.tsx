'use client'
import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Flashcard } from '@/types';

interface FlashcardDeckProps {
  cards: Flashcard[];
  onReview?: (cardId: string, correct: boolean) => void;
}

function isDue(card: Flashcard): boolean {
  if (!card.next_review_at) return true; // never reviewed → due immediately
  return new Date(card.next_review_at) <= new Date();
}

function intervalLabel(days: number): string {
  if (days === 1) return 'tomorrow';
  if (days < 7)  return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

export function FlashcardDeck({ cards, onReview }: FlashcardDeckProps) {
  // Sort: due cards first (preserving relative creation order within each group)
  const sorted = useMemo(() => {
    const due   = cards.filter(c =>  isDue(c));
    const later = cards.filter(c => !isDue(c));
    return [...due, ...later];
  }, [cards]);

  const dueCount = useMemo(() => cards.filter(isDue).length, [cards]);

  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({}); // id → correct

  // Reset position when deck order changes (after a review patches a card)
  useEffect(() => {
    setCurrent(c => Math.min(c, Math.max(0, sorted.length - 1)));
    setFlipped(false);
  }, [sorted.length]);

  if (sorted.length === 0) return null;

  const card = sorted[current];
  const cardReviewed = card.id in reviewed;

  const advance = () => {
    setFlipped(false);
    setCurrent(c => (c < sorted.length - 1 ? c + 1 : c));
  };

  const handleReview = (correct: boolean) => {
    if (cardReviewed) return;
    setReviewed(prev => ({ ...prev, [card.id]: correct }));
    onReview?.(card.id, correct);
    setTimeout(advance, 600); // brief pause so colour feedback registers
  };

  const reviewedCount = Object.keys(reviewed).length;
  const correctCount  = Object.values(reviewed).filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header: progress + due badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-white flex-shrink-0">
        <span className="text-xs text-gray-500 flex-1">{current + 1} / {sorted.length}</span>
        {dueCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <Clock className="h-3 w-3" /> {dueCount} due
          </span>
        )}
        {reviewedCount > 0 && (
          <span className="text-xs text-gray-400">{correctCount}/{reviewedCount} ✓</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-gray-100 flex-shrink-0">
        <div
          className="h-full bg-primary-400 transition-all"
          style={{ width: `${((current + 1) / sorted.length) * 100}%` }}
        />
      </div>

      {/* Scrollable card area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">

        {/* Due indicator on card */}
        {isDue(card) && !card.last_reviewed_at && (
          <p className="text-xs text-center text-amber-500 font-medium">New card</p>
        )}
        {isDue(card) && card.last_reviewed_at && (
          <p className="text-xs text-center text-amber-500 font-medium">Due for review</p>
        )}
        {!isDue(card) && card.next_review_at && (
          <p className="text-xs text-center text-gray-400">
            Next review in {intervalLabel(card.interval_days ?? 1)}
          </p>
        )}

        {/* Flip card */}
        <div
          className="relative cursor-pointer flex-shrink-0"
          style={{ height: '160px', perspective: '1000px' }}
          onClick={() => !cardReviewed && setFlipped(f => !f)}
        >
          <div
            className={cn('absolute inset-0 transition-transform duration-500')}
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front */}
            <div className={cn(
              'absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-4 text-center',
              'bg-gradient-to-br from-primary-500 to-primary-700 text-white',
              '[backface-visibility:hidden]'
            )}>
              <p className="text-[10px] font-medium opacity-60 mb-2 uppercase tracking-wide">
                {cardReviewed ? '—' : 'Tap to reveal'}
              </p>
              <p className="text-sm font-semibold leading-snug">{card.front}</p>
            </div>

            {/* Back */}
            <div className={cn(
              'absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-4 text-center',
              'bg-white border-2',
              cardReviewed
                ? (reviewed[card.id] ? 'border-green-300' : 'border-red-300')
                : 'border-primary-200',
              '[backface-visibility:hidden] [transform:rotateY(180deg)]'
            )}>
              <p className="text-[10px] font-medium text-gray-400 mb-2 uppercase tracking-wide">Answer</p>
              <p className="text-sm text-gray-900 leading-snug">{card.back}</p>
              {card.mnemonic && (
                <p className="text-xs text-primary-600 mt-2 italic">💡 {card.mnemonic}</p>
              )}
            </div>
          </div>
        </div>

        {/* Review buttons — appear after flip, before reviewed */}
        {flipped && !cardReviewed && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => handleReview(false)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
            >
              ✗ Still learning
            </button>
            <button
              onClick={() => handleReview(true)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors"
            >
              ✓ Got it
            </button>
          </div>
        )}

        {/* Post-review feedback */}
        {cardReviewed && (
          <div className={cn(
            'text-xs text-center rounded-lg py-1.5 font-medium flex-shrink-0',
            reviewed[card.id]
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          )}>
            {reviewed[card.id]
              ? `✓ Next review in ${intervalLabel((card.interval_days ?? 0) + 1)}`
              : '✗ Review again tomorrow'}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-auto">
          <button
            onClick={() => { setCurrent(c => Math.max(0, c - 1)); setFlipped(false); }}
            disabled={current === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => { setCurrent(0); setFlipped(false); setReviewed({}); }}
            className="p-1.5 rounded-lg hover:bg-gray-100"
          >
            <RotateCcw className="h-3.5 w-3.5 text-gray-400" />
          </button>
          <button
            onClick={() => { setCurrent(c => Math.min(sorted.length - 1, c + 1)); setFlipped(false); }}
            disabled={current === sorted.length - 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Session complete banner */}
        {reviewedCount === sorted.length && sorted.length > 0 && (
          <div className="rounded-xl bg-primary-50 border border-primary-100 px-3 py-2.5 text-center flex-shrink-0">
            <p className="text-xs font-semibold text-primary-700">Session done!</p>
            <p className="text-xs text-primary-500 mt-0.5">
              {correctCount}/{reviewedCount} correct ·{' '}
              {correctCount === reviewedCount ? 'All cards scheduled 🎉' : 'Keep practising'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
