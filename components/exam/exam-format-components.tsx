'use client'
import { useEffect, useState } from 'react';
import {
  GraduationCap, Plus, Trash2, Play, RefreshCw,
  CheckCircle2, X, Upload, FileText, AlertCircle, ImageIcon, Pencil, Zap,
} from 'lucide-react';
import { useExamStore } from '@/store/examStore';
import type { PaperPreview } from '@/store/examStore';
import { Spinner } from '@/components/ui/Spinner';
import type { ExamSection, ExamFormat } from '@/types';

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ',
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  data_analysis: 'Data Analysis',
  calculation: 'Calculation',
};

export const QUESTION_TYPE_COLORS: Record<string, string> = {
  mcq: 'bg-blue-50 text-blue-700 border-blue-200',
  short_answer: 'bg-green-50 text-green-700 border-green-200',
  long_answer: 'bg-purple-50 text-purple-700 border-purple-200',
  data_analysis: 'bg-amber-50 text-amber-700 border-amber-200',
  calculation: 'bg-red-50 text-red-700 border-red-200',
};

// ─── Section editor row ───────────────────────────────────────────────────────

export function SectionRow({
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

// ─── Paper preview card (internal) ───────────────────────────────────────────

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

export function FormatSetupPanel({
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-gray-100 shadow-xl p-5 space-y-4 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto">
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

          {paperExtracting && (
            <div className="border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3">
              <Spinner className="h-6 w-6 text-primary-500" />
              <p className="text-sm text-gray-500">Extracting questions from {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''}…</p>
              <p className="text-xs text-gray-400">This may take 10–30 seconds</p>
            </div>
          )}

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
    </div>
  );
}

// ─── Format overview card ─────────────────────────────────────────────────────

export function FormatCard({
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-400 hover:shadow-sm transition-all space-y-4">
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
