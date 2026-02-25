'use client'
import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

export function InlineQuiz({ questions }: { questions: Question[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const answered = (qi: number) => answers[qi] !== undefined;
  const correct = (qi: number, oi: number) => oi === questions[qi].correct;

  return (
    <div className="my-3 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Check your understanding</span>
      </div>
      <div className="px-4 py-3 space-y-5">
        {questions.map((q, qi) => (
          <div key={qi}>
            <p className="text-sm font-medium text-gray-800 mb-2.5">{q.question}</p>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                const done = answered(qi);
                const selected = answers[qi] === oi;
                const isCorrect = correct(qi, oi);
                return (
                  <button
                    key={oi}
                    onClick={() => !done && setAnswers(prev => ({ ...prev, [qi]: oi }))}
                    className={cn(
                      'w-full text-left text-sm px-3 py-3 rounded-lg border transition-all cursor-pointer',
                      !done && 'border-gray-200 bg-white text-gray-700 hover:border-primary-400 hover:bg-primary-50',
                      done && !selected && !isCorrect && 'border-gray-100 bg-gray-50 text-gray-400',
                      done && isCorrect && 'border-green-500 bg-green-50 text-green-800',
                      done && selected && !isCorrect && 'border-red-400 bg-red-50 text-red-800',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {done && isCorrect && <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
                      {done && selected && !isCorrect && <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>
            {answered(qi) && q.explanation && (
              <p className="text-xs text-gray-500 mt-2 italic pl-1">{q.explanation}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
