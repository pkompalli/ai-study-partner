'use client'
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CourseInputStep } from '@/components/onboarding/CourseInputStep';
import { GoalStep } from '@/components/onboarding/GoalStep';
import { StructurePreviewStep } from '@/components/onboarding/StructurePreviewStep';
import { ExamFormatSetupStep } from '@/components/onboarding/ExamFormatSetupStep';
import { useCourseStore } from '@/store/courseStore';
import { useUIStore } from '@/store/uiStore';
import { Spinner } from '@/components/ui/Spinner';
import api from '@/lib/api';
import type { Subject } from '@/types';

type Step = 'input' | 'goal' | 'extracting' | 'preview' | 'examFormat';

interface InputData {
  sourceType: string;
  rawInput?: string;
  file?: File;
  files?: File[];
}

interface GoalData {
  goal: 'exam_prep' | 'classwork';
  examName?: string;
  yearOfStudy?: string;
}

interface ExtractedData {
  structure: { subjects: Subject[]; name?: string; description?: string };
  sourceFileUrl?: string;
}

const STEP_LABELS = ['Content', 'Goal', 'Review', 'Exam Format'];

export default function Page() {
  const [step, setStep] = useState<Step>('input');
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);

  // Use refs to avoid stale closure issues
  const inputDataRef = useRef<InputData>({ sourceType: 'text' });
  const goalDataRef = useRef<GoalData>({ goal: 'exam_prep' });

  const { createCourse, fetchCourse } = useCourseStore();
  const addToast = useUIStore(s => s.addToast);
  const router = useRouter();

  const stepIndex = step === 'input' ? 0 : step === 'goal' || step === 'extracting' ? 1 : step === 'preview' ? 2 : 3;

  const handleInput = (data: InputData) => {
    inputDataRef.current = data;
    setStep('goal');
  };

  const handleGoal = async (data: GoalData) => {
    goalDataRef.current = data;
    setStep('extracting');

    const { sourceType, rawInput, file, files } = inputDataRef.current;
    console.log('[OnboardingPage] sending extract | sourceType:', sourceType, '| rawInput length:', rawInput?.length ?? 0, '| files:', files?.length ?? (file ? 1 : 0));

    try {
      const formData = new FormData();
      formData.append('sourceType', sourceType);
      if (rawInput) formData.append('rawInput', rawInput);
      if (files?.length) {
        files.forEach(f => formData.append('files', f));
      } else if (file) {
        formData.append('file', file);
      }

      // Don't set Content-Type manually — let the browser set multipart boundary
      const response = await api.post<{ structure: { subjects: Subject[]; name?: string; description?: string }; sourceFileUrl?: string }>(
        '/api/courses/extract',
        formData,
      );

      const structure = response.data.structure;
      console.log('[OnboardingPage] extracted structure:', JSON.stringify(structure));

      if (!structure?.subjects?.length) {
        addToast('AI could not extract a course structure. Please try more detailed content.', 'error');
        setStep('input');
        return;
      }

      setExtracted({ structure, sourceFileUrl: response.data.sourceFileUrl });
      setStep('preview');
    } catch (err) {
      console.error('[OnboardingPage] extract error:', err);
      addToast('Failed to extract course structure. Please try again.', 'error');
      setStep('goal');
    }
  };

  const handleConfirm = async (structure: { subjects: Subject[] }) => {
    setSaving(true);
    try {
      const { goal, examName, yearOfStudy } = goalDataRef.current;
      const { sourceType, rawInput } = inputDataRef.current;

      const courseId = await createCourse({
        name: extracted?.structure?.name ?? 'My Course',
        description: extracted?.structure?.description,
        goal,
        examName,
        yearOfStudy,
        sourceType,
        sourceFileUrl: extracted?.sourceFileUrl,
        rawInput,
        structure,
      });
      await fetchCourse(courseId);

      if (goal === 'exam_prep') {
        setCreatedCourseId(courseId);
        setStep('examFormat');
      } else {
        addToast('Course created successfully!', 'success');
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('[OnboardingPage] createCourse error:', err);
      addToast('Failed to save course. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, idx) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-1.5">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${idx <= stepIndex ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {idx + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${idx <= stepIndex ? 'text-primary-600' : 'text-gray-400'}`}>{label}</span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 ${idx < stepIndex ? 'bg-primary-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 'input' && <CourseInputStep onNext={handleInput} />}
      {step === 'goal' && <GoalStep onNext={handleGoal} />}
      {step === 'extracting' && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <Spinner className="h-10 w-10" />
          <p className="text-gray-700 font-medium">Analyzing your course content...</p>
          <p className="text-sm text-gray-500">AI is building your course structure</p>
        </div>
      )}
      {step === 'preview' && extracted && (
        <StructurePreviewStep
          structure={extracted.structure}
          onConfirm={handleConfirm}
          loading={saving}
        />
      )}
      {step === 'examFormat' && createdCourseId && (
        <ExamFormatSetupStep
          courseId={createdCourseId}
          examName={goalDataRef.current.examName}
          onComplete={() => {
            addToast('Course and exam format ready!', 'success');
            router.push('/dashboard');
          }}
          onSkip={() => {
            addToast('Course created! Set up exam format later in settings.', 'success');
            router.push('/dashboard');
          }}
        />
      )}
    </div>
  );
}
