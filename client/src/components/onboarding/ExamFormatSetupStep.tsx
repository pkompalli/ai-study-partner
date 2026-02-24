import { useState, useEffect } from 'react';
import {
  GraduationCap, Upload, Plus, Trash2, Zap, X,
  CheckCircle2, FileText, ImageIcon, AlertCircle,
} from 'lucide-react';
import { useExamStore } from '@/store/examStore';
import { Spinner } from '@/components/ui/Spinner';
import type { ExamSection } from '@/types';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ', short_answer: 'Short Answer', long_answer: 'Long Answer',
  data_analysis: 'Data Analysis', calculation: 'Calculation',
};

// ─── Section editor row ───────────────────────────────────────────────────────

function SectionRow({ section, onChange, onDelete }: {
  section: Partial<ExamSection> & { _key: string };
  onChange: (key: string, field: string, value: unknown) => void;
  onDelete: (key: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
        <input className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          placeholder="Section name (e.g. Section A – Multiple Choice)"
          value={section.name ?? ''} onChange={e => onChange(section._key, 'name', e.target.value)} />
        <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
          value={section.question_type ?? 'short_answer'}
          onChange={e => onChange(section._key, 'question_type', e.target.value)}>
          <option value="mcq">Multiple Choice</option>
          <option value="short_answer">Short Answer</option>
          <option value="long_answer">Long Answer</option>
          <option value="data_analysis">Data Analysis</option>
          <option value="calculation">Calculation</option>
        </select>
        <div className="flex items-center gap-1">
          <input type="number" min={1} max={100} className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            placeholder="Qty" value={section.num_questions ?? ''}
            onChange={e => onChange(section._key, 'num_questions', parseInt(e.target.value) || 1)} />
          <span className="text-gray-400 text-xs">q</span>
          <input type="number" min={0} step={0.5} className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm ml-1"
            placeholder="Marks" value={section.marks_per_question ?? ''}
            onChange={e => onChange(section._key, 'marks_per_question', parseFloat(e.target.value) || undefined)} />
          <span className="text-gray-400 text-xs">m</span>
        </div>
      </div>
      <button onClick={() => onDelete(section._key)} className="mt-1 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Format summary card (approve step) ──────────────────────────────────────

function FormatSummaryCard({ name, sections, totalMarks, timeMinutes, questionCount, onApprove, onEdit, approving }: {
  name: string;
  sections: Array<{ name: string; question_type: string; num_questions: number; marks_per_question?: number }>;
  totalMarks?: number;
  timeMinutes?: number;
  questionCount?: number;
  onApprove: () => void;
  onEdit: () => void;
  approving: boolean;
}) {
  const computedTotal = totalMarks ?? sections.reduce((s, sec) => s + (sec.marks_per_question ?? 1) * sec.num_questions, 0);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Review exam format</h2>
        <p className="text-sm text-gray-500 mt-1">Confirm this looks right before locking it in.</p>
      </div>

      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-4 w-4 text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {timeMinutes ? `${timeMinutes} min · ` : ''}{computedTotal} marks
              {questionCount !== undefined ? ` · ${questionCount} questions extracted` : ''}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {sections.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                {QUESTION_TYPE_LABELS[s.question_type] ?? s.question_type}
              </span>
              <span className="text-gray-700 truncate flex-1">{s.name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {s.num_questions}q{s.marks_per_question ? ` × ${s.marks_per_question}m` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onEdit} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          Edit
        </button>
        <button onClick={onApprove} disabled={approving}
          className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
          {approving ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Approve & Lock
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExamFormatSetupStep({ courseId, examName, onComplete, onSkip }: {
  courseId: string;
  examName?: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const {
    inferFormat, createFormat, inferredFormat, inferring, clearInferredFormat,
    extractPaper, extractedPaper, paperExtracting, clearExtractedPaper, importPaper,
  } = useExamStore();

  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');

  // Upload flow state
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);

  // Manual flow state
  const [manualName, setManualName] = useState(examName ?? '');
  const [sections, setSections] = useState<Array<Partial<ExamSection> & { _key: string }>>([
    { _key: '1', name: 'Section A', question_type: 'mcq', num_questions: 10, marks_per_question: 1 },
  ]);
  const [useInferred, setUseInferred] = useState(false);
  const [pendingManual, setPendingManual] = useState<{ name: string; sections: typeof sections } | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (inferredFormat && !useInferred) {
      setManualName(inferredFormat.name ?? manualName);
      if (inferredFormat.sections?.length) {
        setSections(inferredFormat.sections.map((s, i) => ({ ...s, _key: String(i + 1) })));
      }
      setUseInferred(true);
    }
  }, [inferredFormat]);

  // Upload handlers
  const handleStageFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setStagedFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))];
    });
  };

  const handleExtract = async () => {
    if (!stagedFiles.length) return;
    clearExtractedPaper();
    await extractPaper(stagedFiles);
  };

  const handleImportAndApprove = async () => {
    setImporting(true);
    try {
      await importPaper(courseId);
      onComplete();
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => { setStagedFiles([]); clearExtractedPaper(); };

  // Manual handlers
  const handleInfer = async () => {
    if (!manualName.trim()) return;
    clearInferredFormat();
    setUseInferred(false);
    await inferFormat(courseId, manualName.trim());
  };

  const handleAddSection = () => {
    setSections(prev => [...prev, { _key: String(Date.now()), name: '', question_type: 'short_answer', num_questions: 5 }]);
  };

  const handleSectionChange = (key: string, field: string, value: unknown) => {
    setSections(prev => prev.map(s => s._key === key ? { ...s, [field]: value } : s));
  };

  const handleDeleteSection = (key: string) => {
    setSections(prev => prev.filter(s => s._key !== key));
  };

  const handleReviewManual = () => {
    const valid = sections.filter(s => s.name?.trim());
    if (!manualName.trim() || !valid.length) return;
    setPendingManual({ name: manualName.trim(), sections: valid });
  };

  const handleApproveManual = async () => {
    if (!pendingManual) return;
    setApproving(true);
    try {
      await createFormat(courseId, {
        name: pendingManual.name,
        sections: pendingManual.sections.map(s => ({
          name: s.name ?? '',
          question_type: (s.question_type ?? 'short_answer') as ExamSection['question_type'],
          num_questions: s.num_questions ?? 5,
          marks_per_question: s.marks_per_question,
        })),
      });
      onComplete();
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Set up exam format</h2>
        <p className="text-sm text-gray-500 mt-1">Upload a past paper or configure manually. You can edit this later in course settings.</p>
      </div>

      {/* If showing manual review/approve */}
      {pendingManual ? (
        <FormatSummaryCard
          name={pendingManual.name}
          sections={pendingManual.sections.map(s => ({
            name: s.name ?? '',
            question_type: s.question_type ?? 'short_answer',
            num_questions: s.num_questions ?? 5,
            marks_per_question: s.marks_per_question,
          }))}
          onApprove={handleApproveManual}
          onEdit={() => setPendingManual(null)}
          approving={approving}
        />
      ) : extractedPaper && !paperExtracting ? (
        /* If showing upload approve step */
        <FormatSummaryCard
          name={extractedPaper.name}
          sections={extractedPaper.sections}
          totalMarks={extractedPaper.total_marks}
          timeMinutes={extractedPaper.time_minutes}
          questionCount={extractedPaper.questions.length}
          onApprove={handleImportAndApprove}
          onEdit={handleReset}
          approving={importing}
        />
      ) : (
        /* Upload/Manual tabs */
        <>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
            <button onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors ${activeTab === 'upload' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Upload className="h-3.5 w-3.5" /> Upload Past Paper
            </button>
            <button onClick={() => setActiveTab('manual')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 border-l border-gray-200 transition-colors ${activeTab === 'manual' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <GraduationCap className="h-3.5 w-3.5" /> Manual Setup
            </button>
          </div>

          {activeTab === 'upload' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Upload a past exam paper or worksheet — PDF or images. You can add multiple files before extracting.</p>

              {!paperExtracting && (
                <label
                  className={`block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleStageFiles(e.dataTransfer.files); }}>
                  <input type="file" accept=".pdf,image/*" multiple className="sr-only"
                    onChange={e => { if (e.target.files) { handleStageFiles(e.target.files); e.target.value = ''; } }} />
                  <Upload className="h-5 w-5 text-gray-300 mx-auto mb-1.5" />
                  <p className="text-sm text-gray-500 font-medium">Drop files here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF or images · multiple files · max 25 MB</p>
                </label>
              )}

              {stagedFiles.length > 0 && !paperExtracting && (
                <div className="space-y-1.5">
                  {stagedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                      {f.type === 'application/pdf'
                        ? <FileText className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                        : <ImageIcon className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
                      <span className="flex-1 truncate text-gray-700">{f.name}</span>
                      <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setStagedFiles(prev => prev.filter((_, j) => j !== i))}
                        className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={handleExtract}
                    className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 flex items-center justify-center gap-2 transition-colors mt-1">
                    <Zap className="h-3.5 w-3.5" /> Extract {stagedFiles.length} File{stagedFiles.length !== 1 ? 's' : ''}
                  </button>
                </div>
              )}

              {paperExtracting && (
                <div className="border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3">
                  <Spinner className="h-6 w-6 text-primary-500" />
                  <p className="text-sm text-gray-500">Extracting questions…</p>
                  <p className="text-xs text-gray-400">This may take 10–30 seconds</p>
                </div>
              )}

              {extractedPaper && !paperExtracting && extractedPaper.questions_truncated && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  Paper too long — only partial extraction completed
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Exam name</label>
                <div className="flex gap-2">
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. A-Level Chemistry, SAT Math, IB Biology"
                    value={manualName} onChange={e => setManualName(e.target.value)} />
                  <button onClick={handleInfer} disabled={!manualName.trim() || inferring}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 disabled:opacity-50 transition-colors whitespace-nowrap">
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
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {sections.map(s => (
                    <SectionRow key={s._key} section={s} onChange={handleSectionChange} onDelete={handleDeleteSection} />
                  ))}
                </div>
              </div>

              <button onClick={handleReviewManual}
                disabled={!manualName.trim() || sections.filter(s => s.name?.trim()).length === 0}
                className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                Review Format →
              </button>
            </div>
          )}
        </>
      )}

      {/* Skip link (only before approval) */}
      {!pendingManual && !(extractedPaper && !paperExtracting) && (
        <button onClick={onSkip} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
          Skip for now — set up in course settings later
        </button>
      )}
    </div>
  );
}
