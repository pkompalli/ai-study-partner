'use client'
import { useState } from 'react';
import { GraduationCap, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface GoalStepProps {
  onNext: (data: { goal: 'exam_prep' | 'classwork'; examName?: string; yearOfStudy?: string }) => void;
}

export function GoalStep({ onNext }: GoalStepProps) {
  const [goal, setGoal] = useState<'exam_prep' | 'classwork'>('exam_prep');
  const [examName, setExamName] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">What's your learning goal?</h2>
        <p className="text-sm text-gray-600 mt-1">This helps tailor your study experience.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { value: 'exam_prep', label: 'Exam Preparation', desc: 'Focus on key topics and practice questions', icon: <GraduationCap className="h-6 w-6" /> },
          { value: 'classwork', label: 'Classwork', desc: 'Understand concepts deeply for ongoing coursework', icon: <BookOpen className="h-6 w-6" /> },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setGoal(opt.value as 'exam_prep' | 'classwork')}
            className={cn(
              'flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-colors',
              goal === opt.value
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <div className={cn('text-gray-600', goal === opt.value && 'text-primary-600')}>{opt.icon}</div>
            <p className={cn('font-medium text-gray-900', goal === opt.value && 'text-primary-700')}>{opt.label}</p>
            <p className="text-xs text-gray-500">{opt.desc}</p>
          </button>
        ))}
      </div>

      {goal === 'exam_prep' && (
        <Input
          label="Exam name (optional)"
          placeholder="e.g., SAT, USMLE, AWS Certification"
          value={examName}
          onChange={e => setExamName(e.target.value)}
        />
      )}

      <Input
        label="Year of study (optional)"
        placeholder="e.g., Year 2, Sophomore, Graduate"
        value={yearOfStudy}
        onChange={e => setYearOfStudy(e.target.value)}
      />

      <Button
        onClick={() => onNext({ goal, examName: examName || undefined, yearOfStudy: yearOfStudy || undefined })}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}
