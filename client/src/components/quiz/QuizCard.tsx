import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { QuizQuestion } from '@/types';

interface QuizCardProps {
  questions: QuizQuestion[];
  onSubmit: (answers: Record<string, number>) => Promise<{ score: number; total: number }>;
}

export function QuizCard({ questions, onSubmit }: QuizCardProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);

  const question = questions[current];
  const isAnswered = answers[question?.id] !== undefined;
  const allAnswered = questions.every(q => answers[q.id] !== undefined);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const r = await onSubmit(answers);
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    const pct = Math.round((result.score / result.total) * 100);
    return (
      <div className="p-4 space-y-4">
        <div className="text-center">
          <div className={cn('text-4xl font-bold mb-1', pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600')}>
            {result.score}/{result.total}
          </div>
          <p className="text-gray-600 text-sm">{pct}% correct</p>
          <p className="text-sm mt-2">
            {pct >= 80 ? '🎉 Excellent work!' : pct >= 60 ? '👍 Good effort!' : '📚 Keep studying!'}
          </p>
        </div>
        <div className="space-y-3">
          {questions.map(q => {
            const userAnswer = answers[q.id];
            const correct = userAnswer === q.correctIndex;
            return (
              <div key={q.id} className={cn('p-3 rounded-xl border', correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')}>
                <div className="flex items-start gap-2">
                  {correct ? <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{q.question}</p>
                    <p className="text-xs text-gray-600 mt-1">{q.explanation}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Question {current + 1} of {questions.length}</span>
        <span>{Object.keys(answers).length} answered</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full">
        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      <p className="text-sm font-semibold text-gray-900">{question.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((opt, idx) => {
          const selected = answers[question.id] === idx;
          return (
            <button
              key={idx}
              onClick={() => setAnswers(prev => ({ ...prev, [question.id]: idx }))}
              className={cn(
                'w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-colors',
                selected ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        {current > 0 && (
          <Button variant="secondary" onClick={() => setCurrent(c => c - 1)} className="flex-1">
            Previous
          </Button>
        )}
        {current < questions.length - 1 ? (
          <Button
            onClick={() => setCurrent(c => c + 1)}
            disabled={!isAnswered}
            className="flex-1"
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered}
            loading={loading}
            className="flex-1"
          >
            Submit Quiz
          </Button>
        )}
      </div>
    </div>
  );
}
