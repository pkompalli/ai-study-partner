'use client'
import { useState, useEffect } from 'react';
import { Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CheckQuestion } from '@/types';

interface CheckPanelProps {
  questions: CheckQuestion[];
  isLoading: boolean;
  /** Incremented on depth/summary change; resets navigation and answers */
  resetKey: number;
}

export function CheckPanel({ questions, isLoading, resetKey }: CheckPanelProps) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  // Full reset only when depth changes (resetKey bumps), not on every append
  useEffect(() => {
    setCurrent(0);
    setAnswers({});
  }, [resetKey]);

  // When new questions are appended, stay on current question (don't jump)
  // but clamp current to valid range just in case
  useEffect(() => {
    setCurrent(c => Math.min(c, Math.max(0, questions.length - 1)));
  }, [questions.length]);

  const total = questions.length;
  const q = questions[current];
  const answered = answers[current] !== undefined;
  const selectedIdx = answers[current];

  const prev = () => setCurrent(c => Math.max(0, c - 1));
  const next = () => setCurrent(c => Math.min(total - 1, c + 1));

  const selectAnswer = (oi: number) => {
    if (answered) return;
    setAnswers(prev => ({ ...prev, [current]: oi }));
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header with navigation */}
      <div className="px-3 py-2 border-b border-orange-100 bg-orange-50 flex items-center gap-2 flex-shrink-0">
        <Lightbulb className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
        <p className="text-xs font-semibold text-orange-700 flex-1">Check</p>

        {!isLoading && total > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={prev}
              disabled={current === 0}
              className="p-0.5 rounded hover:bg-orange-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-orange-600" />
            </button>
            <span className="text-xs text-orange-600 tabular-nums min-w-[36px] text-center">
              {current + 1}/{total}
            </span>
            <button
              onClick={next}
              disabled={current === total - 1}
              className="p-0.5 rounded hover:bg-orange-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5 text-orange-600" />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-3 bg-orange-100 rounded w-5/6" />
            <div className="h-3 bg-orange-100 rounded w-3/4" />
            <div className="space-y-2 mt-4">
              <div className="h-8 bg-gray-100 rounded-lg" />
              <div className="h-8 bg-gray-100 rounded-lg" />
              <div className="h-8 bg-gray-100 rounded-lg" />
              <div className="h-8 bg-gray-100 rounded-lg" />
            </div>
          </div>
        ) : total === 0 ? (
          <p className="text-xs text-gray-400 text-center pt-6 leading-relaxed px-2">
            Comprehension questions will appear once content loads.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Progress dots */}
            {total > 1 && (
              <div className="flex gap-1 justify-center mb-1">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === current
                        ? 'w-4 bg-orange-500'
                        : answers[i] !== undefined
                          ? (answers[i] === questions[i].correctIndex ? 'w-1.5 bg-green-400' : 'w-1.5 bg-red-400')
                          : 'w-1.5 bg-orange-200'
                    )}
                  />
                ))}
              </div>
            )}

            {/* Question */}
            <p className="text-xs font-medium text-gray-800 leading-snug">
              {q.question}
            </p>

            {/* Options */}
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                const selected = selectedIdx === oi;
                const isCorrect = oi === q.correctIndex;
                return (
                  <button
                    key={oi}
                    onClick={() => selectAnswer(oi)}
                    disabled={answered}
                    className={cn(
                      'w-full text-left px-2.5 py-2 rounded-lg text-xs border transition-colors',
                      !answered && 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer',
                      answered && isCorrect && 'bg-green-50 border-green-300 text-green-800 font-medium',
                      answered && selected && !isCorrect && 'bg-red-50 border-red-300 text-red-700',
                      answered && !selected && !isCorrect && 'border-gray-100 bg-gray-50 text-gray-400',
                    )}
                  >
                    <span className="mr-1.5 text-gray-400 font-mono text-[10px]">
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {answered && (
              <div className={cn(
                'rounded-lg px-2.5 py-2 text-xs leading-relaxed border',
                selectedIdx === q.correctIndex
                  ? 'bg-green-50 border-green-100 text-green-800'
                  : 'bg-gray-50 border-gray-100 text-gray-600'
              )}>
                {q.explanation}
              </div>
            )}

            {/* Next arrow shortcut when answered and not last */}
            {answered && current < total - 1 && (
              <button
                onClick={next}
                className="w-full text-xs text-orange-600 hover:text-orange-700 font-medium py-1 flex items-center justify-center gap-1 transition-colors"
              >
                Next question <ChevronRight className="h-3 w-3" />
              </button>
            )}

            {/* Completion summary */}
            {answeredCount === total && total > 1 && (
              <div className="mt-2 text-center text-xs text-gray-500">
                {Object.entries(answers).filter(([i, a]) => a === questions[+i].correctIndex).length}/{total} correct
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
