'use client'
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, GraduationCap, Plus, Trash2, Play, RefreshCw,
  ChevronRight, X, CheckCircle2, XCircle,
  BookOpen, Zap, BarChart2, Upload, FileText, AlertCircle, ImageIcon, Pencil,
} from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import { useExamStore } from '@/store/examStore';
import type { PaperPreview } from '@/store/examStore';
import { Spinner } from '@/components/ui/Spinner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ExamSection, ExamFormat, LocalAnswerState } from '@/types';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ',
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  data_analysis: 'Data Analysis',
  calculation: 'Calculation',
};

const QUESTION_TYPE_COLORS: Record<string, string> = {
  mcq: 'bg-blue-50 text-blue-700 border-blue-200',
  short_answer: 'bg-green-50 text-green-700 border-green-200',
  long_answer: 'bg-purple-50 text-purple-700 border-purple-200',
  data_analysis: 'bg-amber-50 text-amber-700 border-amber-200',
  calculation: 'bg-red-50 text-red-700 border-red-200',
};

// ─── Section editor row ───────────────────────────────────────────────────────

function SectionRow({
  section, onChange, onDelete,
}: {
  section: Partial<ExamSection> & { _key: string };
  onChange: (key: string, field: string, value: unknown) => void;
  onDelete: (key: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
        <input
          className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          placeholder="Section name (e.g. Section A – Multiple Choice)"
          value={section.name ?? ''}
          onChange={e => onChange(section._key, 'name', e.target.value)}
        />
        <select
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
          value={section.question_type ?? 'short_answer'}
          onChange={e => onChange(section._key, 'question_type', e.target.value)}
        >
          <option value="mcq">Multiple Choice</option>
          <option value="short_answer">Short Answer</option>
          <option value="long_answer">Long Answer</option>
          <option value="data_analysis">Data Analysis</option>
          <option value="calculation">Calculation</option>
        </select>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={100}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            placeholder="Qty"
            value={section.num_questions ?? ''}
            onChange={e => onChange(section._key, 'num_questions', parseInt(e.target.value) || 1)}
          />
          <span className="text-gray-400 text-xs">questions</span>
          <input
            type="number"
            min={0}
            step={0.5}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm ml-1"
            placeholder="Marks"
            value={section.marks_per_question ?? ''}
            onChange={e => onChange(section._key, 'marks_per_question', parseFloat(e.target.value) || undefined)}
          />
          <span className="text-gray-400 text-xs">marks ea.</span>
        </div>
      </div>
      <button onClick={() => onDelete(section._key)} className="mt-1 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Paper preview card ───────────────────────────────────────────────────────

function PaperPreviewCard({
  preview,
  onImport,
  importing,
}: {
  preview: PaperPreview;
  onImport: () => void;
  importing: boolean;
}) {
  const totalQ = preview.questions.length;
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-green-900 truncate">{preview.name}</p>
          <p className="text-xs text-green-600 mt-0.5">
            {preview.sections.length} section{preview.sections.length !== 1 ? 's' : ''}
            {preview.total_marks ? ` · ${preview.total_marks} marks` : ''}
            {preview.time_minutes ? ` · ${preview.time_minutes} min` : ''}
          </p>
        </div>
      </div>
      <div className="space-y-1">
        {preview.sections.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={`px-1.5 py-0.5 rounded border font-medium ${QUESTION_TYPE_COLORS[s.question_type] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
              {QUESTION_TYPE_LABELS[s.question_type] ?? s.question_type}
            </span>
            <span className="text-green-800 truncate flex-1">{s.name}</span>
            <span className="text-green-500 flex-shrink-0">{s.num_questions}q</span>
          </div>
        ))}
      </div>
      {preview.questions_truncated && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Paper was too long — {totalQ} question{totalQ !== 1 ? 's' : ''} extracted (may be incomplete)
        </div>
      )}
      {!preview.questions_truncated && (
        <p className="text-xs text-green-600">{totalQ} question{totalQ !== 1 ? 's' : ''} extracted</p>
      )}
      <button
        onClick={onImport}
        disabled={importing}
        className="w-full py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        {importing ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Import {totalQ} Question{totalQ !== 1 ? 's' : ''}
      </button>
    </div>
  );
}

// ─── Format setup panel ───────────────────────────────────────────────────────

function FormatSetupPanel({
  courseId,
  examName,
  onClose,
  onCreated,
}: {
  courseId: string;
  examName?: string;
  onClose: () => void;
  onCreated: (fmt: ExamFormat) => void;
}) {
  const {
    inferFormat, createFormat, inferredFormat, inferring, clearInferredFormat,
    extractPaper, extractedPaper, paperExtracting, clearExtractedPaper, importPaper,
  } = useExamStore();

  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const [name, setName] = useState(examName ?? '');
  const [sections, setSections] = useState<Array<Partial<ExamSection> & { _key: string }>>([
    { _key: '1', name: 'Section A', question_type: 'mcq', num_questions: 10, marks_per_question: 1 },
  ]);
  const [saving, setSaving] = useState(false);
  const [useInferred, setUseInferred] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  // When inferred format is received, populate form
  useEffect(() => {
    if (inferredFormat && !useInferred) {
      setName(inferredFormat.name ?? name);
      if (inferredFormat.sections?.length) {
        setSections(inferredFormat.sections.map((s, i) => ({ ...s, _key: String(i + 1) })));
      }
      setUseInferred(true);
    }
  }, [inferredFormat]);

  const handleInfer = async () => {
    if (!name.trim()) return;
    clearInferredFormat();
    setUseInferred(false);
    await inferFormat(courseId, name.trim());
  };

  const handleAddSection = () => {
    const key = String(Date.now());
    setSections(prev => [...prev, { _key: key, name: '', question_type: 'short_answer', num_questions: 5 }]);
  };

  const handleSectionChange = (key: string, field: string, value: unknown) => {
    setSections(prev => prev.map(s => s._key === key ? { ...s, [field]: value } : s));
  };

  const handleDeleteSection = (key: string) => {
    setSections(prev => prev.filter(s => s._key !== key));
  };

  const handleCreate = async () => {
    if (!name.trim() || sections.length === 0) return;
    setSaving(true);
    try {
      const validSections = sections.filter(s => s.name?.trim());
      const fmt = await createFormat(courseId, {
        name: name.trim(),
        sections: validSections.map(s => ({
          name: s.name ?? '',
          question_type: (s.question_type ?? 'short_answer') as ExamSection['question_type'],
          num_questions: s.num_questions ?? 5,
          marks_per_question: s.marks_per_question,
        })),
      });
      onCreated(fmt);
    } finally {
      setSaving(false);
    }
  };

  const handleStageFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setStagedFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))];
    });
  };

  const handleExtract = async () => {
    if (stagedFiles.length === 0) return;
    clearExtractedPaper();
    await extractPaper(stagedFiles);
  };

  const handleRemoveStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setStagedFiles([]);
    clearExtractedPaper();
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const fmt = await importPaper(courseId);
      onCreated(fmt);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-primary-600" />
        <h3 className="font-semibold text-gray-900">Set up Exam Format</h3>
        <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-gray-100">
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${activeTab === 'upload' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Paper
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors border-l border-gray-200 ${activeTab === 'manual' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          Manual Setup
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Upload a past exam paper or class worksheet — PDF or images. You can add multiple pages/files before extracting.</p>

          {/* Drop zone — always visible unless we have extraction results */}
          {!extractedPaper && !paperExtracting && (
            <>
              <label
                className={`block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleStageFiles(e.dataTransfer.files); }}
              >
                <input
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  className="sr-only"
                  onChange={e => { if (e.target.files) { handleStageFiles(e.target.files); e.target.value = ''; } }}
                />
                <Upload className="h-5 w-5 text-gray-300 mx-auto mb-1.5" />
                <p className="text-sm text-gray-500 font-medium">Drop files here or click to browse</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF or images · multiple files supported · max 25 MB</p>
              </label>

              {/* Staged file list */}
              {stagedFiles.length > 0 && (
                <div className="space-y-1.5">
                  {stagedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                      {f.type === 'application/pdf'
                        ? <FileText className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                        : <ImageIcon className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                      }
                      <span className="flex-1 truncate text-gray-700">{f.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <button
                        onClick={() => handleRemoveStagedFile(i)}
                        className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={handleExtract}
                    disabled={stagedFiles.length === 0}
                    className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors mt-1"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Extract {stagedFiles.length} File{stagedFiles.length !== 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Extracting spinner */}
          {paperExtracting && (
            <div className="border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3">
              <Spinner className="h-6 w-6 text-primary-500" />
              <p className="text-sm text-gray-500">Extracting questions from {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''}…</p>
              <p className="text-xs text-gray-400">This may take 10–30 seconds</p>
            </div>
          )}

          {/* Extracted preview */}
          {extractedPaper && !paperExtracting && (
            <div className="space-y-2">
              <PaperPreviewCard preview={extractedPaper} onImport={handleImport} importing={importing} />
              <button
                onClick={handleReset}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Start over with different files
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'manual' && (
        <>
          {/* Name + auto-infer */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Exam name</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. A-Level Chemistry, SAT Math, IB Biology"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <button
                onClick={handleInfer}
                disabled={!name.trim() || inferring}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {inferring ? <Spinner className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                Auto-generate
              </button>
            </div>
            {inferredFormat && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Format generated — review sections below
              </p>
            )}
          </div>

          {/* Sections */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sections</label>
              <button onClick={handleAddSection} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800">
                <Plus className="h-3 w-3" /> Add section
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sections.map(s => (
                <SectionRow key={s._key} section={s} onChange={handleSectionChange} onDelete={handleDeleteSection} />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim() || sections.filter(s => s.name?.trim()).length === 0}
              className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Spinner className="h-3.5 w-3.5" /> : null}
              Create Format
            </button>
          </div>
        </>
      )}

      {activeTab === 'upload' && !extractedPaper && !paperExtracting && stagedFiles.length === 0 && (
        <button onClick={onClose} className="w-full py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      )}
    </div>
  );
}

// ─── Format overview card ─────────────────────────────────────────────────────

function FormatCard({
  format,
  onGenerate,
  onStartPractice,
  onDelete,
  onEdit,
  generating,
}: {
  format: ExamFormat;
  onGenerate: () => void;
  onStartPractice: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  generating: boolean;
}) {
  const totalSectionMarks = format.sections.reduce((s, sec) => s + (sec.total_marks ?? (sec.marks_per_question ?? 1) * sec.num_questions), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base">{format.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {format.time_minutes ? `${format.time_minutes} min` : ''}
            {format.time_minutes && totalSectionMarks ? ' · ' : ''}
            {totalSectionMarks ? `${format.total_marks ?? totalSectionMarks} marks` : ''}
          </p>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sections list */}
      <div className="space-y-1.5">
        {format.sections.map(section => (
          <div key={section.id} className="flex items-center gap-2 text-sm">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${QUESTION_TYPE_COLORS[section.question_type]}`}>
              {QUESTION_TYPE_LABELS[section.question_type]}
            </span>
            <span className="text-gray-700 truncate flex-1">{section.name}</span>
            <span className="text-gray-400 text-xs flex-shrink-0">
              {section.num_questions}q
              {section.marks_per_question ? ` × ${section.marks_per_question}` : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Question bank status */}
      <div className="pt-1 border-t border-gray-100">
        {format.question_count > 0 ? (
          <p className="text-xs text-green-600 flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {format.question_count} questions ready
          </p>
        ) : (
          <p className="text-xs text-gray-400 mb-3">Question bank empty — generate to start practising</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 disabled:opacity-60 transition-colors"
          >
            {generating ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {format.question_count > 0 ? 'Regenerate' : 'Generate Questions'}
          </button>
          <button
            onClick={onStartPractice}
            disabled={format.question_count === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Start Practice
          </button>
        </div>
      </div>
    </div>
  );
}

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

export default function Page() {
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
