'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Compass, BookOpen, Lightbulb, Brain, ChevronLeft, ChevronRight, Bookmark, Check, GraduationCap, CheckCircle2, XCircle, Settings, Minus, Plus, Paperclip, BookMarked } from 'lucide-react';
import { useSessionStore } from '@/store/sessionStore';
import { useCourseStore } from '@/store/courseStore';
import { useUIStore } from '@/store/uiStore';
import { useExamStore } from '@/store/examStore';
import { ChatWindow } from '@/components/session/ChatWindow';
import { ChatInput } from '@/components/session/ChatInput';
import { TopicSummary } from '@/components/session/TopicSummary';
import { FlashcardDeck } from '@/components/flashcards/FlashcardDeck';
import { Spinner } from '@/components/ui/Spinner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import type { ExamQuestion } from '@/types';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Easy', 2: 'Medium-Easy', 3: 'Standard', 4: 'Hard', 5: 'Stretch',
};

/**
 * Wraps bare LaTeX environments (\begin{env}...\end{env}) in $$...$$ so that
 * remark-math can process them. Without this, the LLM sometimes outputs
 * \begin{align*} blocks without $ wrappers and they render as plain text.
 */
function preprocessLatex(content: string): string {
  if (!content) return content;
  // Pre-step: normalize commands KaTeX doesn't support → supported equivalents
  let s = content
    .replace(/\\cdotp/g, '\\cdot')
    .replace(/\\boldsymbol\{/g, '\\mathbf{');
  // Step 1: convert \[...\] → $$...$$ and \(...\) → $...$ before markdown strips backslashes
  s = s
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, body) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body) => `$${body}$`);
  // Step 2: protect already-valid $...$ / $$...$$ blocks from double-processing
  const saved: string[] = [];
  s = s.replace(
    /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g,
    (m) => { saved.push(m); return `\x02${saved.length - 1}\x03`; },
  );
  // Step 2b: wrap standalone \ce{...} outside math in $...$
  s = s.replace(/\\ce\{([^}]*)\}/g, match => `$${match}$`);
  // Step 3: wrap bare \begin{env}...\end{env} blocks in $$...$$
  s = s.replace(
    /\\begin\{([^}]+)\}([\s\S]*?)\\end\{\1\}/g,
    (_, env, body) => `\n$$\n\\begin{${env}}${body}\\end{${env}}\n$$\n`,
  );
  // Step 4: restore the protected blocks
  return s.replace(/\x02(\d+)\x03/g, (_, i) => saved[+i]);
}

const QUESTION_TYPE_COLORS: Record<string, string> = {
  mcq: 'bg-blue-50 text-blue-700 border-blue-200',
  short_answer: 'bg-green-50 text-green-700 border-green-200',
  long_answer: 'bg-purple-50 text-purple-700 border-purple-200',
  data_analysis: 'bg-amber-50 text-amber-700 border-amber-200',
  calculation: 'bg-red-50 text-red-700 border-red-200',
};
const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ', short_answer: 'Short Answer', long_answer: 'Long Answer',
  data_analysis: 'Data Analysis', calculation: 'Calculation',
};

// ─── Exam Prep Tab ─────────────────────────────────────────────────────────────

function ExamPrepTab({
  formats, sessionBatch, sessionAnswers, sessionMarkingId,
  sessionBatchLoading, sessionBatchGenerating, sessionBatchError, examDifficulty,
  sessionHints, sessionHintLoading, requestedCount,
  sessionFullAnswers, sessionFullAnswerLoading,
  onLoadBatch, onLoadMore, onSetAnswerText, onSetOption, onSubmit, onRefreshBatch, onNavigateSettings,
  onFetchHint, onClearHint, onSetRequestedCount, onFetchFullAnswer,
}: {
  formats: import('@/types').ExamFormat[];
  sessionBatch: ExamQuestion[];
  sessionAnswers: Record<string, { answerText: string; selectedOptionIndex?: number; score?: number; feedback?: string; marked: boolean }>;
  sessionMarkingId: string | null;
  sessionBatchLoading: boolean;
  sessionBatchGenerating: boolean;
  sessionBatchError: string | null;
  examDifficulty: number;
  sessionHints: Record<string, { text: string; count: number }>;
  sessionHintLoading: string | null;
  requestedCount: number;
  sessionFullAnswers: Record<string, string>;
  sessionFullAnswerLoading: string | null;
  onLoadBatch: (formatId: string) => void;
  onLoadMore: (formatId: string) => void;
  onSetAnswerText: (qId: string, text: string) => void;
  onSetOption: (qId: string, idx: number) => void;
  onSubmit: (qId: string, files?: File[]) => void;
  onRefreshBatch: (formatId: string, difficulty: number) => void;
  onNavigateSettings: () => void;
  onFetchHint: (qId: string, answerText?: string) => void;
  onClearHint: (qId: string) => void;
  onSetRequestedCount: (n: number) => void;
  onFetchFullAnswer: (qId: string) => void;
}) {
  const format = formats[0] ?? null;

  // Only block on missing format when there are no questions to show
  if (!format && sessionBatch.length === 0) {
    if (sessionBatchLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="h-6 w-6 text-primary-400" />
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <GraduationCap className="h-8 w-8 text-gray-200" />
        <p className="text-sm font-medium text-gray-700">No exam format set up yet</p>
        <p className="text-xs text-gray-400">Set up your exam format in course settings to start practising questions.</p>
        <button onClick={onNavigateSettings}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 transition-colors">
          <Settings className="h-3.5 w-3.5" /> Course Settings
        </button>
      </div>
    );
  }

  if (sessionBatchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="h-6 w-6 text-primary-400" />
      </div>
    );
  }

  if (sessionBatch.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <GraduationCap className="h-8 w-8 text-gray-200" />
        <p className="text-sm font-semibold text-gray-700">How many questions?</p>
        <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
          {[5, 10, 15, 20].map(n => (
            <button key={n} onClick={() => onSetRequestedCount(n)}
              className={`py-2 rounded-lg text-sm font-semibold border transition-colors
                ${requestedCount === n
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
              {n}
            </button>
          ))}
        </div>
        <button onClick={() => onLoadBatch(format.id)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors">
          <GraduationCap className="h-4 w-4" /> Start ({requestedCount} questions)
        </button>
        {sessionBatchError && (
          <p className="text-xs text-red-500 max-w-xs">Error: {sessionBatchError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Difficulty + More bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-100">
        <span className="text-xs text-gray-500 font-medium">Difficulty:</span>
        <button onClick={() => onRefreshBatch(format.id, examDifficulty - 1)} disabled={examDifficulty <= 1 || sessionBatchLoading}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-opacity">
          <Minus className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <span className="text-xs font-semibold text-primary-700 min-w-[80px] text-center">
          {examDifficulty} — {DIFFICULTY_LABELS[examDifficulty]}
        </span>
        <button onClick={() => onRefreshBatch(format.id, examDifficulty + 1)} disabled={examDifficulty >= 5 || sessionBatchLoading}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-opacity">
          <Plus className="h-3.5 w-3.5 text-gray-600" />
        </button>
        <button
          onClick={() => onLoadMore(format.id)}
          disabled={sessionBatchGenerating}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
        >
          {sessionBatchGenerating ? <Spinner className="h-3 w-3" /> : null}
          {requestedCount} more ↓
        </button>
      </div>

      {/* Questions */}
      <div className="px-4 py-3 space-y-4">
        {sessionBatch.map((question, qi) => (
          <ExamQuestionCard
            key={question.id}
            question={question}
            index={qi}
            localAnswer={sessionAnswers[question.id] ?? { answerText: '', marked: false }}
            isMarking={sessionMarkingId === question.id}
            hint={sessionHints[question.id]}
            isHintLoading={sessionHintLoading === question.id}
            fullAnswer={sessionFullAnswers[question.id]}
            isFullAnswerLoading={sessionFullAnswerLoading === question.id}
            onSetText={(t) => onSetAnswerText(question.id, t)}
            onSetOption={(i) => onSetOption(question.id, i)}
            onSubmit={(files) => onSubmit(question.id, files)}
            onFetchHint={(answerText) => onFetchHint(question.id, answerText)}
            onClearHint={() => onClearHint(question.id)}
            onFetchFullAnswer={() => onFetchFullAnswer(question.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ExamQuestionCard({
  question, index, localAnswer, isMarking, hint, isHintLoading,
  fullAnswer, isFullAnswerLoading,
  onSetText, onSetOption, onSubmit, onFetchHint, onClearHint, onFetchFullAnswer,
}: {
  question: ExamQuestion;
  index: number;
  localAnswer: { answerText: string; selectedOptionIndex?: number; score?: number; feedback?: string; marked: boolean };
  isMarking: boolean;
  hint?: { text: string; count: number };
  isHintLoading: boolean;
  fullAnswer?: string;
  isFullAnswerLoading: boolean;
  onSetText: (t: string) => void;
  onSetOption: (i: number) => void;
  onSubmit: (files?: File[]) => void;
  onFetchHint: (answerText?: string) => void;
  onClearHint: () => void;
  onFetchFullAnswer: () => void;
}) {
  const [answerFiles, setAnswerFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFullAnswer, setShowFullAnswer] = useState(false);

  // Clear attached files once the question is marked
  useEffect(() => {
    if (localAnswer.marked) setAnswerFiles([]);
  }, [localAnswer.marked]);

  // Auto-show the model answer panel when it first loads
  useEffect(() => {
    if (fullAnswer) setShowFullAnswer(true);
  }, [fullAnswer]);

  const isMcq = question.section_question_type === 'mcq';
  const isMarked = localAnswer.marked;
  const canSubmit = isMcq
    ? localAnswer.selectedOptionIndex !== undefined
    : localAnswer.answerText.trim().length > 0 || answerFiles.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium">Q{index + 1}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${QUESTION_TYPE_COLORS[question.section_question_type] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          {QUESTION_TYPE_LABELS[question.section_question_type] ?? question.section_question_type}
        </span>
        {question.topic_name && <span className="text-xs text-gray-400">{question.topic_name}</span>}
        <span className="ml-auto text-xs text-gray-500">{question.max_marks}m</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {question.dataset && (
          <div className="bg-gray-50 rounded-lg p-3 text-xs border border-gray-200 overflow-x-auto">
            <ReactMarkdown
              className="prose prose-xs max-w-none text-gray-700"
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
            >{preprocessLatex(question.dataset)}</ReactMarkdown>
          </div>
        )}

        <div className="text-sm text-gray-900 font-medium leading-relaxed">
          <ReactMarkdown
            className="prose prose-sm max-w-none"
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
          >{preprocessLatex(question.question_text)}</ReactMarkdown>
        </div>


        {/* Answer */}
        {isMcq ? (
          <div className="space-y-1.5">
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
                <button key={idx} disabled={locked} onClick={() => onSetOption(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${cls}`}>
                  <span className="w-4 h-4 rounded-full border flex items-center justify-center text-xs flex-shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">
                    <ReactMarkdown
                      components={{ p: ({ children }) => <>{children}</> }}
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
                    >{preprocessLatex(opt)}</ReactMarkdown>
                  </span>
                  {locked && isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
                  {locked && selected && !isCorrect && <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={3}
              disabled={isMarked}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-600"
              placeholder="Write your answer..."
              value={localAnswer.answerText}
              onChange={e => onSetText(e.target.value)}
            />
            {/* File attach (images / PDF) */}
            {!isMarked && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => {
                      setAnswerFiles(prev => [...prev, ...Array.from(e.target.files ?? [])]);
                      e.target.value = '';
                    }}
                  />
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Attach images / PDF</span>
                </label>
                {answerFiles.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5 text-xs text-gray-600 max-w-[140px] truncate">
                    {f.name}
                    <button type="button" onClick={() => setAnswerFiles(prev => prev.filter((_, j) => j !== i))}
                      className="ml-1 text-gray-400 hover:text-red-500 flex-shrink-0">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {isMarked && (
          <div className={`rounded-lg p-3 ${localAnswer.score! >= question.max_marks ? 'bg-green-50 border border-green-200' : localAnswer.score! > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {localAnswer.score! >= question.max_marks
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                : localAnswer.score! > 0
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
                  : <XCircle className="h-3.5 w-3.5 text-red-500" />
              }
              <span className="text-xs font-semibold">{localAnswer.score}/{question.max_marks} marks</span>
            </div>
            {localAnswer.feedback && (
              <ReactMarkdown
                className="prose prose-xs max-w-none text-xs text-gray-700 leading-relaxed"
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
              >{preprocessLatex(localAnswer.feedback)}</ReactMarkdown>
            )}
          </div>
        )}

        {/* Hint display */}
        {hint && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 relative">
            <button onClick={onClearHint} className="absolute top-2 right-2 text-amber-300 hover:text-amber-500">
              <XCircle className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-start gap-2 pr-5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <ReactMarkdown
                className="prose prose-xs max-w-none text-xs text-amber-800 leading-relaxed"
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
              >{preprocessLatex(hint.text)}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Full answer display — only shown when showFullAnswer is true */}
        {fullAnswer && showFullAnswer && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <BookMarked className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-700">Model Answer</span>
            </div>
            <ReactMarkdown
              className="prose prose-xs max-w-none text-xs text-emerald-900 leading-relaxed"
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
            >{preprocessLatex(fullAnswer)}</ReactMarkdown>
          </div>
        )}

        {/* Submit + Hint + Show Answer row */}
        {!isMarked && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onFetchHint(localAnswer.answerText || undefined)}
              disabled={isHintLoading || (hint?.count ?? 0) >= 2}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              {isHintLoading ? <Spinner className="h-3 w-3" /> : <Lightbulb className="h-3 w-3 text-amber-500" />}
              {(hint?.count ?? 0) > 0 ? `Hint (${hint!.count}/2)` : 'Hint'}
            </button>
            <button
              onClick={() => fullAnswer ? setShowFullAnswer(s => !s) : onFetchFullAnswer()}
              disabled={isFullAnswerLoading}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors flex-shrink-0"
              title="Show or hide the complete worked answer"
            >
              {isFullAnswerLoading ? <Spinner className="h-3 w-3" /> : <BookMarked className="h-3 w-3 text-emerald-600" />}
              {fullAnswer ? (showFullAnswer ? 'Hide Answer' : 'Show Answer') : 'Show Answer'}
            </button>
            <button
              onClick={() => onSubmit(answerFiles.length > 0 ? answerFiles : undefined)}
              disabled={isMarking || !canSubmit}
              className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {isMarking ? <Spinner className="h-3 w-3" /> : null}
              Submit Answer
            </button>
          </div>
        )}

        {/* Show / Hide Model Answer after marking */}
        {isMarked && (
          <button
            onClick={() => fullAnswer ? setShowFullAnswer(s => !s) : onFetchFullAnswer()}
            disabled={isFullAnswerLoading}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
          >
            {isFullAnswerLoading ? <Spinner className="h-3 w-3" /> : <BookMarked className="h-3 w-3" />}
            {fullAnswer ? (showFullAnswer ? 'Hide Model Answer' : 'Show Model Answer') : 'Show Model Answer'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Session Page ──────────────────────────────────────────────────────────────

export default function SessionPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const {
    activeSession, messages, isStreaming, streamingContent, regeneratingIndex,
    activeFlashcards,
    topicSummary, summaryStreaming, summaryStreamingContent, summaryDepth,
    responsePills, pillsLoading,
    loadSession, sendMessage,
    fetchSummary, regenerateMessage, reviewCard, saveCardFromQuestion,
  } = useSessionStore();
  const { fetchCourse } = useCourseStore();
  const { addToast } = useUIStore();

  const {
    formats, fetchFormats,
    sessionBatch, sessionBatchLoading, sessionBatchGenerating, sessionBatchError,
    sessionAnswers, sessionMarkingId, examDifficulty,
    sessionHints, sessionHintLoading,
    sessionFullAnswers, sessionFullAnswerLoading, fetchSessionFullAnswer,
    requestedCount, setRequestedCount,
    loadSessionBatch, loadMoreSessionBatch, refreshBatchAtDifficulty,
    setSessionAnswerText, setSessionSelectedOption, submitSessionAnswer,
    fetchSessionHint, clearSessionHint,
  } = useExamStore();

  const [loading, setLoading] = useState(true);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [centerTab, setCenterTab] = useState<'study' | 'exam'>('study');
  // Panel toggle
  const [rightOpen, setRightOpen] = useState(true);

  // MCQ history
  const [mcqHistory, setMcqHistory] = useState<
    Array<{ question: string; answerPills: string[]; correctIndex: number; explanation: string }>
  >([]);
  const [mcqHistoryIndex, setMcqHistoryIndex] = useState(0);
  const [mcqSelections, setMcqSelections] = useState<Record<number, number>>({});
  const [savedMcqIndices, setSavedMcqIndices] = useState<Set<number>>(new Set());

  // Flashcard panel
  const [reviewMode, setReviewMode] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    loadSession(id).then(async () => {
      const session = useSessionStore.getState().activeSession;
      if (session?.course_id) {
        fetchCourse(session.course_id).catch(() => {});
        // Always fetch formats eagerly so the exam tab is ready immediately
        fetchFormats(session.course_id).catch(() => {});
        router.prefetch(`/courses/${session.course_id}`);
      }
      fetchSummary(id, 0);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id, loadSession, fetchSummary, fetchCourse, fetchFormats, router]);

  const visibleMessages = messages.filter(m => m.role !== 'system');

  // MCQ derived values
  const mcqQuestion = responsePills?.answerPills?.length
    ? responsePills.question
    : (!summaryStreaming && visibleMessages.length === 0 ? (topicSummary?.question ?? '') : '');
  const mcqPills = responsePills?.answerPills?.length
    ? responsePills.answerPills
    : (!summaryStreaming && visibleMessages.length === 0 ? (topicSummary?.answerPills ?? []) : []);
  const mcqCorrectIndex = responsePills?.answerPills?.length
    ? responsePills.correctIndex
    : (topicSummary?.correctIndex ?? -1);
  const mcqExplanation = responsePills?.answerPills?.length
    ? responsePills.explanation
    : (topicSummary?.explanation ?? '');

  // Scroll to bottom on new messages or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleMessages.length, streamingContent]);

  // Accumulate MCQ history — new question → push + jump to end
  useEffect(() => {
    if (!mcqQuestion || !mcqPills.length) return;
    setMcqHistory(prev => {
      if (prev[prev.length - 1]?.question === mcqQuestion) return prev;
      const next = [...prev, {
        question: mcqQuestion, answerPills: mcqPills,
        correctIndex: mcqCorrectIndex, explanation: mcqExplanation,
      }];
      setMcqHistoryIndex(next.length - 1);
      return next;
    });
  }, [mcqQuestion]);

  const currentMcq = mcqHistory[mcqHistoryIndex] ?? null;

  // Explore strip
  const exploreItems: string[] = responsePills?.followupPills?.length
    ? responsePills.followupPills
    : (topicSummary?.starters ?? []);
  const showExplore = exploreItems.length > 0 && !summaryStreaming && activeSession?.status === 'active';

  const handleSend = async (content: string) => {
    try {
      await sendMessage(content);
    } catch {
      addToast('Failed to send message', 'error');
    }
  };

  const handleOpenExamTab = () => {
    setCenterTab('exam');
  };

  const handleLoadExamBatch = async (formatId: string) => {
    await loadSessionBatch(formatId, activeSession?.topic_id, activeSession?.chapter_id);
  };

  const handleLoadMoreExamBatch = async (formatId: string) => {
    await loadMoreSessionBatch(formatId, activeSession?.topic_id, activeSession?.chapter_id);
  };

  const handleRefreshBatch = async (formatId: string, difficulty: number) => {
    await refreshBatchAtDifficulty(formatId, difficulty, activeSession?.topic_id, activeSession?.chapter_id);
  };

  const handleSummaryDepthChange = (newDepth: number) => {
    if (!id) return;
    const clamped = Math.max(1, Math.min(5, newDepth));
    fetchSummary(id, clamped);
  };

  const handleSummaryRefresh = () => {
    if (!id) return;
    fetchSummary(id, summaryDepth, true); // force=true bypasses server cache
  };

  const handleRegenerate = async (visibleIndex: number, depth: number) => {
    try {
      await regenerateMessage(visibleIndex, depth);
    } catch {
      addToast('Failed to regenerate response', 'error');
    }
  };

  const handleSaveCard = async (historyIndex: number) => {
    const mcq = mcqHistory[historyIndex];
    if (!mcq) return;
    const correctAnswer = mcq.answerPills[mcq.correctIndex];
    const saved = await saveCardFromQuestion(mcq.question, correctAnswer, mcq.explanation);
    if (saved) setSavedMcqIndices(prev => new Set(prev).add(historyIndex));
  };

  const handleBackToCourse = () => {
    const courseId = activeSession?.course_id;
    if (window.history.length > 1) {
      router.back();
      return;
    }
    if (courseId) {
      router.push(`/courses/${courseId}`);
      return;
    }
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const hasSummary = topicSummary !== null || summaryStreaming;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        <button
          onClick={handleBackToCourse}
          className="p-1 rounded-lg hover:bg-gray-100"
          title="Back to course"
        >
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {activeSession?.title ?? 'Study Session'}
          </p>
          <p className="text-xs text-gray-400">
            {activeSession?.status === 'active' ? 'Active session' : 'Session ended'}
          </p>
        </div>
        <button
          onClick={() => router.push('/settings')}
          className="p-1 rounded-lg hover:bg-gray-100"
          title="Settings & exam formats"
        >
          <Settings className="h-4 w-4 text-gray-500" />
        </button>
        <button onClick={() => setRightOpen(o => !o)} className="p-1 rounded-lg hover:bg-gray-100" title="Toggle check panel">
          <Brain className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 min-h-0">

        {/* CENTER COLUMN */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-100">

          {/* Tab bar */}
          <div className="flex border-b border-gray-100 flex-shrink-0">
            <button
              onClick={() => setCenterTab('study')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${centerTab === 'study' ? 'border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <BookOpen className="h-3.5 w-3.5" /> Study
            </button>
            <button
              onClick={handleOpenExamTab}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${centerTab === 'exam' ? 'border-primary-500 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <GraduationCap className="h-3.5 w-3.5" /> Exam Practice
            </button>
          </div>

          {/* STUDY TAB */}
          {centerTab === 'study' && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="px-4">
                  {hasSummary && (
                    <TopicSummary
                      summary={topicSummary?.summary ?? ''}
                      isStreaming={summaryStreaming}
                      streamingContent={summaryStreamingContent}
                      collapsed={summaryCollapsed}
                      onToggle={() => setSummaryCollapsed(c => !c)}
                      depth={summaryDepth}
                      onDepthChange={handleSummaryDepthChange}
                      onRefresh={handleSummaryRefresh}
                    />
                  )}
                  {!hasSummary && visibleMessages.length === 0 && (
                    <div className="flex items-center justify-center py-16">
                      <Spinner className="h-6 w-6 text-primary-400" />
                    </div>
                  )}
                  {(visibleMessages.length > 0 || (isStreaming && regeneratingIndex === null)) && (
                    <ChatWindow
                      messages={messages}
                      isStreaming={isStreaming}
                      streamingContent={streamingContent}
                      regeneratingIndex={regeneratingIndex}
                      onRegenerate={handleRegenerate}
                    />
                  )}
                </div>
              </div>
              {showExplore && (
                <div className="border-t border-gray-100 bg-primary-50 px-4 py-2.5 flex-shrink-0">
                  <p className="text-xs font-semibold text-primary-700 mb-2 flex items-center gap-1">
                    <Compass className="h-3 w-3" /> Explore
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {exploreItems.map((item, i) => (
                      <button key={i} onClick={() => handleSend(item)}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-white border border-primary-200 text-primary-800 hover:bg-primary-100 transition-colors text-center leading-snug">
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {activeSession?.status === 'active' && (
                <ChatInput onSend={handleSend} disabled={isStreaming} placeholder="Ask your AI tutor anything..." />
              )}
            </>
          )}

          {/* EXAM PRACTICE TAB */}
          {centerTab === 'exam' && (
            <ExamPrepTab
              formats={formats}
              sessionBatch={sessionBatch}
              sessionAnswers={sessionAnswers}
              sessionMarkingId={sessionMarkingId}
              sessionBatchLoading={sessionBatchLoading}
              sessionBatchGenerating={sessionBatchGenerating}
              sessionBatchError={sessionBatchError}
              examDifficulty={examDifficulty}
              sessionHints={sessionHints}
              sessionHintLoading={sessionHintLoading}
              requestedCount={requestedCount}
              sessionFullAnswers={sessionFullAnswers}
              sessionFullAnswerLoading={sessionFullAnswerLoading}
              onLoadBatch={handleLoadExamBatch}
              onLoadMore={handleLoadMoreExamBatch}
              onSetAnswerText={setSessionAnswerText}
              onSetOption={setSessionSelectedOption}
              onSubmit={async (qId, files) => { await submitSessionAnswer(qId, files); }}
              onRefreshBatch={handleRefreshBatch}
              onNavigateSettings={() => router.push(`/courses/${activeSession?.course_id}/settings`)}
              onFetchHint={(qId, answerText) => fetchSessionHint(qId, answerText)}
              onClearHint={clearSessionHint}
              onSetRequestedCount={setRequestedCount}
              onFetchFullAnswer={fetchSessionFullAnswer}
            />
          )}
        </div>

        {/* RIGHT PANEL — collapsible, default open */}
        {rightOpen && (
          <div className="w-80 flex-shrink-0 border-l border-gray-100 flex flex-col min-h-0">

            {/* MCQ — 65%, hidden when in Exam Prep tab */}
            {centerTab === 'study' && <div className="flex flex-col border-b border-gray-100 min-h-0 overflow-hidden" style={{ flex: 65 }}>
              {/* Header with history navigation */}
              <div className="px-3 py-2 border-b border-gray-100 bg-orange-50 flex-shrink-0 flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-orange-700 flex-1">Check</span>
                {mcqHistory.length > 0 && (
                  <>
                    <button
                      disabled={mcqHistoryIndex === 0}
                      onClick={() => setMcqHistoryIndex(i => i - 1)}
                      className="p-0.5 rounded hover:bg-orange-100 disabled:opacity-30 transition-opacity"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 text-orange-500" />
                    </button>
                    <span className="text-xs text-orange-400 tabular-nums px-0.5">
                      {mcqHistoryIndex + 1}/{mcqHistory.length}
                    </span>
                    <button
                      disabled={mcqHistoryIndex === mcqHistory.length - 1}
                      onClick={() => setMcqHistoryIndex(i => i + 1)}
                      className="p-0.5 rounded hover:bg-orange-100 disabled:opacity-30 transition-opacity"
                    >
                      <ChevronRight className="h-3.5 w-3.5 text-orange-500" />
                    </button>
                  </>
                )}
              </div>

              {/* Scrollable MCQ body */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {currentMcq ? (
                  <>
                    <p className="text-sm font-medium text-gray-800 mb-3 leading-snug">
                      {currentMcq.question}
                    </p>
                    <div className="space-y-2">
                      {currentMcq.answerPills.map((pill, i) => {
                        const selected = mcqSelections[mcqHistoryIndex];
                        const locked = selected !== undefined;
                        const isSelected = selected === i;
                        const isCorrect = i === currentMcq.correctIndex;
                        let cls = 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer';
                        if (locked) {
                          if (isSelected && isCorrect)  cls = 'bg-green-100 border border-green-400 text-green-800';
                          else if (isCorrect)            cls = 'bg-green-50  border border-green-300 text-green-700';
                          else if (isSelected)           cls = 'bg-red-100   border border-red-400   text-red-800';
                          else                           cls = 'bg-white border border-gray-100 text-gray-400 opacity-50';
                        }
                        return (
                          <button
                            key={i}
                            disabled={locked}
                            onClick={() => setMcqSelections(prev => ({ ...prev, [mcqHistoryIndex]: i }))}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${cls}`}
                          >
                            {locked && isSelected && isCorrect  && <span className="flex-shrink-0 text-green-600">✓</span>}
                            {locked && isSelected && !isCorrect && <span className="flex-shrink-0 text-red-600">✗</span>}
                            <span>{pill}</span>
                          </button>
                        );
                      })}
                    </div>
                    {mcqSelections[mcqHistoryIndex] !== undefined && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        {currentMcq.explanation && (
                          <p className="text-xs text-gray-600 leading-snug">{currentMcq.explanation}</p>
                        )}
                        {savedMcqIndices.has(mcqHistoryIndex) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Check className="h-3 w-3" /> Saved to deck
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSaveCard(mcqHistoryIndex)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            <Bookmark className="h-3 w-3" /> Save as flashcard
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    {pillsLoading || summaryStreaming
                      ? <Spinner className="h-5 w-5 text-orange-300" />
                      : <p className="text-xs text-gray-400 text-center leading-relaxed">Questions appear here<br/>as you study.</p>
                    }
                  </div>
                )}
              </div>
            </div>}

            {/* Saved cards — full height in exam mode, 35% in study mode */}
            {(() => {
              const savedCards = activeFlashcards?.cards ?? [];
              return (
                <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: centerTab === 'exam' ? 1 : 35 }}>
                  {reviewMode ? (
                    <>
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0 flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-600 flex-1">Review</p>
                        <button
                          onClick={() => setReviewMode(false)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ✕ Exit
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <FlashcardDeck
                          cards={savedCards}
                          onReview={(cardId, correct) => reviewCard(cardId, correct)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0 flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-600 flex-1">Saved Cards</p>
                        {savedCards.length > 0 && (
                          <>
                            <span className="text-xs text-gray-400">{savedCards.length}</span>
                            <button
                              onClick={() => setReviewMode(true)}
                              className="text-xs font-medium text-primary-600 hover:text-primary-800"
                            >
                              Start Review →
                            </button>
                          </>
                        )}
                      </div>
                      {savedCards.length > 0 ? (
                        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                          {savedCards.map(card => (
                            <div
                              key={card.id}
                              className="text-xs text-gray-700 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100 leading-snug"
                            >
                              {card.front}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 gap-2">
                          <BookOpen className="h-5 w-5 text-gray-200" />
                          <p className="text-xs text-gray-400 leading-relaxed">
                            Answer a question and tap<br/>"Save as flashcard" to build<br/>your review deck.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

          </div>
        )}

      </div>
    </div>
  );
}
