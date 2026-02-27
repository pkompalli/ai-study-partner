'use client'
import { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface Card {
  term: string;
  definition: string;
}

export function InlineFlashcards({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[index];
  const go = (delta: number) => {
    setIndex(i => Math.max(0, Math.min(cards.length - 1, i + delta)));
    setFlipped(false);
  };

  return (
    <div className="my-3 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Key Terms</span>
        <span className="text-xs text-gray-400">{index + 1} / {cards.length}</span>
      </div>

      {/* Card */}
      <div
        onClick={() => setFlipped(f => !f)}
        className={`mx-4 my-3 min-h-[72px] flex flex-col items-center justify-center p-4 rounded-lg border cursor-pointer transition-colors text-center select-none ${flipped ? 'bg-primary-50 border-primary-200' : 'bg-white border-gray-200 hover:border-primary-300'}`}
      >
        {flipped
          ? <p className="text-sm text-primary-900 leading-relaxed">{card.definition}</p>
          : <p className="text-sm font-semibold text-gray-900">{card.term}</p>
        }
        <p className="text-[10px] text-gray-400 mt-2">
          {flipped ? 'tap for term' : 'tap to reveal'}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 pb-3">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="flex items-center gap-1 text-xs text-primary-600 disabled:opacity-30 hover:text-primary-700 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>
        <button
          onClick={() => { setIndex(0); setFlipped(false); }}
          className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
          title="Restart"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
        <button
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
          className="flex items-center gap-1 text-xs text-primary-600 disabled:opacity-30 hover:text-primary-700 transition-colors"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
