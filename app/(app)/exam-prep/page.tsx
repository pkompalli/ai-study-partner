'use client'
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, GraduationCap, Plus,
  ChevronRight, X, CheckCircle2, XCircle,
  BookOpen, BarChart2,
} from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import { useExamStore } from '@/store/examStore';
import { Spinner } from '@/components/ui/Spinner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ExamFormat, LocalAnswerState } from '@/types';
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_COLORS,
  FormatCard,
  FormatSetupPanel,
} from '@/components/exam/exam-format-components';

// ─── Readiness chart ───────────────────────────────────────────────────────────

function ReadinessPanel({ courseId }: { courseId: string }) {
  const { readiness, fetchReadiness } = useExamStore();

  useEffect(() => {
    fetchReadiness(courseId).catch(() => {});
  }, [courseId]);

  if (readiness.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Topic Readiness</h3>
      </div>
      <div className="space-y-2.5">
        {readiness.map(r => (
          <div key={r.topic_id}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600 truncate max-w-[200px]">{r.topic_name}</span>
              <span className="text-gray-400 ml-2 flex-shrink-0">{r.readiness_score}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${r.readiness_score >= 70 ? 'bg-green-500' : r.readiness_score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${r.readiness_score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Practice session view ────────────────────────────────────────────────────

function PracticeSession() {
  const {
    questions, currentQuestionIndex, answers,
    setAnswerText, setSelectedOption, submitAnswer,
    nextQuestion, exitPractice, markingQuestionId,
    practiceComplete,
  } = useExamStore();

  if (practiceComplete) {
    return <PracticeSummary />;
  }

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const question = questions[currentQuestionIndex];
  if (!question) return null;

  const localAnswer: LocalAnswerState = answers[question.id] ?? { answerText: '', hintsUsed: 0, marked: false };
  const isMarking = markingQuestionId === question.id;
  const isMarked = localAnswer.marked;
  const isMcq = question.section_question_type === 'mcq';

  const progress = ((currentQuestionIndex) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={exitPractice}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center gap-1.5 text-sm"
        >
          <X className="h-4 w-4" />
          Exit
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Question meta */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${QUESTION_TYPE_COLORS[question.section_question_type] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {QUESTION_TYPE_LABELS[question.section_question_type] ?? question.section_question_type}
          </span>
          <span className="text-xs text-gray-400">{question.section_name}</span>
          {question.topic_name && (
            <>
              <span className="text-gray-200">·</span>
              <span className="text-xs text-gray-400">{question.topic_name}</span>
            </>
          )}
          <span className="ml-auto text-xs font-medium text-gray-500">{question.max_marks} mark{question.max_marks !== 1 ? 's' : ''}</span>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Dataset (data analysis) */}
          {question.dataset && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200 overflow-x-auto">
              <ReactMarkdown
              className="prose prose-sm max-w-none text-gray-700"
              remarkPlugins={[remarkMath]}
              rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
            >{question.dataset}</ReactMarkdown>
            </div>
          )}

          {/* Question text */}
          <ReactMarkdown
            className="prose prose-sm max-w-none text-gray-900 font-medium leading-relaxed"
            remarkPlugins={[remarkMath]}
            rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
          >{question.question_text}</ReactMarkdown>

          {/* Answer input */}
          {isMcq ? (
            <div className="space-y-2">
              {question.options?.map((opt, idx) => {
                const selected = localAnswer.selectedOptionIndex === idx;
                const locked = isMarked;
                const isCorrect = idx === question.correct_option_index;
                let cls = 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50';
                if (locked) {
                  if (isCorrect) cls = 'bg-green-50 border border-green-400 text-green-800';
                  else if (selected) cls = 'bg-red-50 border border-red-400 text-red-800';
                  else cls = 'bg-white border border-gray-100 text-gray-400 opacity-60';
                } else if (selected) {
                  cls = 'bg-primary-50 border border-primary-400 text-primary-800';
                }

                return (
                  <button
                    key={idx}
                    disabled={locked}
                    onClick={() => setSelectedOption(question.id, idx)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center gap-3 ${cls}`}
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1">
                      <ReactMarkdown
                        components={{ p: ({ children }) => <>{children}</> }}
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                      >{opt}</ReactMarkdown>
                    </span>
                    {locked && isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />}
                    {locked && selected && !isCorrect && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              rows={5}
              disabled={isMarked}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-600"
              placeholder="Write your answer here..."
              value={localAnswer.answerText}
              onChange={e => setAnswerText(question.id, e.target.value)}
            />
          )}

          {/* Marking feedback */}
          {isMarked && (
            <div className={`rounded-xl p-4 space-y-2 ${localAnswer.score! >= question.max_marks ? 'bg-green-50 border border-green-200' : localAnswer.score! > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {localAnswer.score! >= question.max_marks
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : localAnswer.score! > 0
                    ? <CheckCircle2 className="h-4 w-4 text-amber-500" />
                    : <XCircle className="h-4 w-4 text-red-500" />
                }
                <span className="text-sm font-semibold">
                  {localAnswer.score}/{question.max_marks} mark{question.max_marks !== 1 ? 's' : ''}
                </span>
              </div>
              {localAnswer.feedback && (
                <ReactMarkdown
                  className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-700"
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                >{localAnswer.feedback}</ReactMarkdown>
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="px-5 pb-4 flex items-center gap-2">
          {!isMarked && (
            <button
              onClick={() => submitAnswer(question.id)}
              disabled={isMarking || (isMcq ? localAnswer.selectedOptionIndex === undefined : !localAnswer.answerText.trim())}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isMarking ? <Spinner className="h-3.5 w-3.5" /> : null}
              Submit Answer
            </button>
          )}
          {isMarked && (
            <button
              onClick={nextQuestion}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish'}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Practice summary ─────────────────────────────────────────────────────────

function PracticeSummary() {
  const { questions, answers, exitPractice } = useExamStore();

  const totalScore = Object.values(answers).reduce((s, a) => s + (a.score ?? 0), 0);
  const maxScore = questions.reduce((s, q) => s + q.max_marks, 0);
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  // Group by section
  const bySection = questions.reduce<Record<string, { name: string; score: number; max: number }>>((acc, q) => {
    if (!acc[q.section_id]) acc[q.section_id] = { name: q.section_name, score: 0, max: 0 };
    const a = answers[q.id];
    acc[q.section_id].score += a?.score ?? 0;
    acc[q.section_id].max += q.max_marks;
    return acc;
  }, {});

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-3">
        <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center"
          style={{ background: pct >= 70 ? '#dcfce7' : pct >= 40 ? '#fef9c3' : '#fee2e2' }}>
          <span className="text-2xl font-bold" style={{ color: pct >= 70 ? '#16a34a' : pct >= 40 ? '#ca8a04' : '#dc2626' }}>
            {pct}%
          </span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Practice Complete!</h2>
        <p className="text-sm text-gray-500">{totalScore} / {maxScore} marks</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">By Section</h3>
        {Object.entries(bySection).map(([id, s]) => (
          <div key={id} className="flex items-center gap-3 text-sm">
            <span className="flex-1 text-gray-700">{s.name}</span>
            <span className="text-gray-400">{s.score}/{s.max}</span>
            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${s.max > 0 && (s.score / s.max) >= 0.7 ? 'bg-green-500' : s.max > 0 && (s.score / s.max) >= 0.4 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${s.max > 0 ? (s.score / s.max) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={exitPractice}
        className="w-full py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 flex items-center justify-center gap-2"
      >
        <BookOpen className="h-4 w-4" />
        Back to Exam Prep
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExamPrepPage() {
  const params = useParams();
  const courseId = params?.id as string;
  const router = useRouter();
  const { activeCourse, fetchCourse } = useCourseStore();
  const {
    formats, formatsLoading, fetchFormats,
    generateQuestions,
    startPractice, activeAttempt,
    deleteFormat, setActiveFormat,
  } = useExamStore();

  const [showSetup, setShowSetup] = useState(false);
  const [generatingFormatId, setGeneratingFormatId] = useState<string | null>(null);

  useEffect(() => {
    if (courseId) {
      fetchCourse(courseId).catch(() => {});
      fetchFormats(courseId);
    }
  }, [courseId]);

  // If in practice mode, show practice session
  if (activeAttempt) {
    return <PracticeSession />;
  }

  const course = activeCourse?.id === courseId ? activeCourse : null;

  const handleGenerate = async (formatId: string) => {
    setGeneratingFormatId(formatId);
    try {
      await generateQuestions(formatId);
    } finally {
      setGeneratingFormatId(null);
    }
  };

  const handleStartPractice = async (format: ExamFormat) => {
    setActiveFormat(format);
    await startPractice(format.id);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push(`/courses/${courseId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {course?.name ?? 'Course'}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Exam Prep</h1>
            {course?.exam_name && (
              <p className="text-sm text-gray-500 mt-0.5">{course.exam_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Format setup panel */}
      {showSetup && courseId && (
        <FormatSetupPanel
          courseId={courseId}
          examName={course?.exam_name}
          onClose={() => setShowSetup(false)}
          onCreated={() => setShowSetup(false)}
        />
      )}

      {/* Loading state */}
      {formatsLoading && (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {/* Empty state */}
      {!formatsLoading && formats.length === 0 && !showSetup && (
        <div className="text-center py-12 space-y-4">
          <div className="h-14 w-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto">
            <GraduationCap className="h-7 w-7 text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">No exam format yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
              Set up an exam format to generate a practice question bank tailored to your exam.
            </p>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Set up Exam Format
          </button>
        </div>
      )}

      {/* Format cards */}
      {!formatsLoading && formats.length > 0 && (
        <div className="space-y-4">
          {formats.map(format => (
            <FormatCard
              key={format.id}
              format={format}
              onGenerate={() => handleGenerate(format.id)}
              onStartPractice={() => handleStartPractice(format)}
              onDelete={() => deleteFormat(format.id)}
              generating={generatingFormatId === format.id}
            />
          ))}
          {!showSetup && (
            <button
              onClick={() => setShowSetup(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add another exam format
            </button>
          )}
        </div>
      )}

      {/* Readiness */}
      {!formatsLoading && courseId && <ReadinessPanel courseId={courseId} />}
    </div>
  );
}
