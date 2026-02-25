import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, GraduationCap, BookOpen, Plus, ChevronDown, ChevronRight,
  Pencil, Check, X, RefreshCw, Trash2, Edit3, ClipboardList,
} from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import { useExamStore } from '@/store/examStore';
import { Spinner } from '@/components/ui/Spinner';
import { FormatCard, FormatSetupPanel, SectionRow } from '@/pages/ExamPrepPage';
import type { ExamFormat, ExamSection, Course } from '@/types';
import api from '@/lib/api';

// ─── Scoring Rubric Editor ────────────────────────────────────────────────────

const DEFAULT_RUBRIC_DESCRIPTION = `By default, questions are marked using the following criteria per type:
• MCQ — correct option = full marks, otherwise 0
• Calculation — Method (1 mark), Substitution (1 mark), Answer + Units (remaining marks)
• Short Answer — each criterion worth 1 mark; point-based marking
• Long Answer — grouped into Knowledge, Application, Analysis, Evaluation bands
• Data Analysis — per-criterion; processing the data required, not just reading it off`;

function RubricEditor() {
  const [rubric, setRubric] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ scoringRubric: string }>('/api/exam/settings');
      setRubric(data.scoringRubric ?? '');
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => { setDraft(rubric); setEditing(true); };
  const cancel = () => setEditing(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/api/exam/settings', { scoringRubric: draft });
      setRubric(draft);
      setEditing(false);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await api.patch('/api/exam/settings', { scoringRubric: '' });
      setRubric('');
      setEditing(false);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <ClipboardList className="h-4.5 w-4.5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Scoring Rubric</h2>
          <p className="text-xs text-gray-400 mt-0.5">Custom marking instructions applied when generating and marking questions</p>
        </div>
        {!editing && !loading && (
          <button onClick={startEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Default rubric description (always visible) */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Default Rubric</p>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{DEFAULT_RUBRIC_DESCRIPTION}</pre>
        </div>

        {/* Custom instructions */}
        {loading ? (
          <div className="flex justify-center py-3"><Spinner className="h-4 w-4" /></div>
        ) : editing ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
              Custom Marking Instructions
            </label>
            <textarea
              rows={5}
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
              placeholder="e.g. Award marks for correct working even if the final answer is wrong. Do not penalise for minor unit errors..."
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={cancel} className="flex-1 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={reset} disabled={saving} className="px-3 py-2 rounded-lg border border-red-200 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                Reset to Default
              </button>
              <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Spinner className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Custom Instructions</p>
            {rubric ? (
              <p className="text-xs text-gray-700 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed">{rubric}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">None — using default rubric only. Click the edit icon above to add custom instructions.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline course name / exam_name editor ────────────────────────────────────

function CourseEditor({ course }: { course: Course }) {
  const { updateCourse } = useCourseStore();
  const [editingName, setEditingName] = useState(false);
  const [editingExam, setEditingExam] = useState(false);
  const [nameVal, setNameVal] = useState(course.name);
  const [examVal, setExamVal] = useState(course.exam_name ?? '');
  const [saving, setSaving] = useState(false);

  const saveName = async () => {
    if (!nameVal.trim() || nameVal === course.name) { setEditingName(false); return; }
    setSaving(true);
    try { await updateCourse(course.id, { name: nameVal.trim() }); }
    finally { setSaving(false); setEditingName(false); }
  };

  const saveExam = async () => {
    if (examVal === (course.exam_name ?? '')) { setEditingExam(false); return; }
    setSaving(true);
    try { await updateCourse(course.id, { exam_name: examVal.trim() || undefined }); }
    finally { setSaving(false); setEditingExam(false); }
  };

  return (
    <div className="space-y-1.5">
      {/* Course name */}
      <div className="flex items-center gap-2">
        {editingName ? (
          <>
            <input
              autoFocus
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm font-semibold"
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameVal(course.name); setEditingName(false); } }}
            />
            <button onClick={saveName} disabled={saving} className="p-1 rounded hover:bg-green-50 text-green-600 disabled:opacity-50">
              {saving ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => { setNameVal(course.name); setEditingName(false); }} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-gray-900">{course.name}</span>
            <button onClick={() => setEditingName(true)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <Pencil className="h-3 w-3" />
            </button>
          </>
        )}
      </div>

      {/* Exam name (only for exam_prep courses) */}
      {course.goal === 'exam_prep' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-16 flex-shrink-0">Exam:</span>
          {editingExam ? (
            <>
              <input
                autoFocus
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs"
                placeholder="e.g. A-Level Chemistry, IB Biology"
                value={examVal}
                onChange={e => setExamVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveExam(); if (e.key === 'Escape') { setExamVal(course.exam_name ?? ''); setEditingExam(false); } }}
              />
              <button onClick={saveExam} disabled={saving} className="p-1 rounded hover:bg-green-50 text-green-600 disabled:opacity-50">
                {saving ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => { setExamVal(course.exam_name ?? ''); setEditingExam(false); }} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-gray-600">{course.exam_name || <span className="italic text-gray-400">not set</span>}</span>
              <button onClick={() => setEditingExam(true)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <Pencil className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inline format editor ─────────────────────────────────────────────────────

function FormatEditor({
  format,
  onSave,
  onCancel,
}: {
  format: ExamFormat;
  onSave: (updated: ExamFormat) => void;
  onCancel: () => void;
}) {
  const { updateFormat } = useExamStore();
  const [name, setName] = useState(format.name);
  const [timeMinutes, setTimeMinutes] = useState(format.time_minutes?.toString() ?? '');
  const [totalMarks, setTotalMarks] = useState(format.total_marks?.toString() ?? '');
  const [sections, setSections] = useState<Array<Partial<ExamSection> & { _key: string }>>(
    format.sections.map(s => ({ ...s, _key: s.id }))
  );
  const [saving, setSaving] = useState(false);

  const handleSectionChange = (key: string, field: string, value: unknown) => {
    setSections(prev => prev.map(s => s._key === key ? { ...s, [field]: value } : s));
  };

  const handleDeleteSection = (key: string) => {
    setSections(prev => prev.filter(s => s._key !== key));
  };

  const handleAddSection = () => {
    setSections(prev => [...prev, { _key: String(Date.now()), name: '', question_type: 'short_answer', num_questions: 5 }]);
  };

  const handleSave = async () => {
    const validSections = sections.filter(s => s.name?.trim());
    if (!name.trim() || validSections.length === 0) return;
    setSaving(true);
    try {
      const updated = await updateFormat(format.id, {
        name: name.trim(),
        time_minutes: timeMinutes ? parseInt(timeMinutes) : undefined,
        total_marks: totalMarks ? parseInt(totalMarks) : undefined,
        sections: validSections.map(s => ({
          name: s.name ?? '',
          question_type: (s.question_type ?? 'short_answer') as ExamSection['question_type'],
          num_questions: s.num_questions ?? 5,
          marks_per_question: s.marks_per_question,
        })),
      });
      onSave(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit Exam Format</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-gray-500 mb-1 block">Format name</label>
          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Time (min)</label>
          <input
            type="number"
            min={1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. 90"
            value={timeMinutes}
            onChange={e => setTimeMinutes(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Total marks</label>
          <input
            type="number"
            min={1}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. 100"
            value={totalMarks}
            onChange={e => setTotalMarks(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sections</label>
          <button onClick={handleAddSection} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800">
            <Plus className="h-3 w-3" /> Add section
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {sections.map(s => (
            <SectionRow key={s._key} section={s} onChange={handleSectionChange} onDelete={handleDeleteSection} />
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || sections.filter(s => s.name?.trim()).length === 0}
          className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ─── Course structure editor ──────────────────────────────────────────────────

type EditSubject = { id?: string; _key: string; name: string; open: boolean; topics: Array<{ id?: string; _key: string; name: string }> };

function CourseStructureEditor({
  course,
  onSave,
  onCancel,
}: {
  course: Course;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { replaceStructure } = useCourseStore();

  const initialSubjects = (): EditSubject[] =>
    (course.subjects ?? []).map(s => ({
      id: s.id,
      _key: s.id,
      name: s.name,
      open: true,
      topics: s.topics.map(t => ({ id: t.id, _key: t.id, name: t.name })),
    }));

  const [subjects, setSubjects] = useState<EditSubject[]>(initialSubjects);
  const [saving, setSaving] = useState(false);

  const toggleOpen = (key: string) =>
    setSubjects(prev => prev.map(s => s._key === key ? { ...s, open: !s.open } : s));

  const updateSubjectName = (key: string, name: string) =>
    setSubjects(prev => prev.map(s => s._key === key ? { ...s, name } : s));

  const deleteSubject = (key: string) =>
    setSubjects(prev => prev.filter(s => s._key !== key));

  const addSubject = () =>
    setSubjects(prev => [...prev, { _key: String(Date.now()), name: '', open: true, topics: [] }]);

  const updateTopicName = (sKey: string, tKey: string, name: string) =>
    setSubjects(prev => prev.map(s => s._key === sKey
      ? { ...s, topics: s.topics.map(t => t._key === tKey ? { ...t, name } : t) }
      : s));

  const deleteTopic = (sKey: string, tKey: string) =>
    setSubjects(prev => prev.map(s => s._key === sKey
      ? { ...s, topics: s.topics.filter(t => t._key !== tKey) }
      : s));

  const addTopic = (sKey: string) =>
    setSubjects(prev => prev.map(s => s._key === sKey
      ? { ...s, open: true, topics: [...s.topics, { _key: String(Date.now()), name: '' }] }
      : s));

  const handleSave = async () => {
    const valid = subjects.filter(s => s.name.trim());
    if (valid.length === 0) return;
    setSaving(true);
    try {
      await replaceStructure(course.id, valid.map(s => ({
        id: s.id,
        name: s.name.trim(),
        topics: s.topics.filter(t => t.name.trim()).map(t => ({ id: t.id, name: t.name.trim() })),
      })));
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit Course Structure</p>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {subjects.map(subject => (
          <div key={subject._key} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            {/* Subject row */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-100">
              <button onClick={() => toggleOpen(subject._key)} className="flex-shrink-0 p-0.5">
                {subject.open
                  ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                }
              </button>
              <input
                className="flex-1 text-sm font-semibold bg-transparent border-none outline-none focus:ring-1 focus:ring-primary-300 rounded px-1 py-0.5 text-gray-900"
                placeholder="Subject name"
                value={subject.name}
                onChange={e => updateSubjectName(subject._key, e.target.value)}
              />
              <span className="text-xs text-gray-400 flex-shrink-0">{subject.topics.length}t</span>
              <button onClick={() => deleteSubject(subject._key)} className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Topics */}
            {subject.open && (
              <div className="px-3 py-2 space-y-1.5">
                {subject.topics.map(topic => (
                  <div key={topic._key} className="flex items-center gap-1.5">
                    <span className="text-gray-300 text-xs flex-shrink-0">•</span>
                    <input
                      className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 text-gray-800"
                      placeholder="Topic name"
                      value={topic.name}
                      onChange={e => updateTopicName(subject._key, topic._key, e.target.value)}
                    />
                    <button onClick={() => deleteTopic(subject._key, topic._key)} className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addTopic(subject._key)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 mt-0.5"
                >
                  <Plus className="h-3 w-3" /> Add topic
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addSubject}
        className="w-full py-2 rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Add subject
      </button>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || subjects.filter(s => s.name.trim()).length === 0}
          className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          Save Structure
        </button>
      </div>
    </div>
  );
}

// ─── Per-course section ───────────────────────────────────────────────────────

function CourseSection({ course }: { course: Course }) {
  const navigate = useNavigate();
  const {
    fetchFormats, generateQuestions, deleteFormat, setActiveFormat,
  } = useExamStore();
  const [open, setOpen] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [showStructureEditor, setShowStructureEditor] = useState(false);
  const [editingFormatId, setEditingFormatId] = useState<string | null>(null);
  const [generatingFormatId, setGeneratingFormatId] = useState<string | null>(null);
  const [courseFormats, setCourseFormats] = useState<ExamFormat[]>([]);
  const [loadingFormats, setLoadingFormats] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingFormats(true);
    fetchFormats(course.id).then(() => {
      setCourseFormats(useExamStore.getState().formats);
    }).finally(() => setLoadingFormats(false));
  }, [open, course.id]);

  // Keep formats in sync with store when they change
  useExamStore(s => {
    const storeFormats = s.formats;
    if (storeFormats !== courseFormats && storeFormats.length > 0) {
      if (storeFormats.some(f => courseFormats.some(cf => cf.id === f.id) || courseFormats.length === 0)) {
        setCourseFormats(storeFormats);
      }
    }
  });

  const handleGenerate = async (formatId: string) => {
    setGeneratingFormatId(formatId);
    try { await generateQuestions(formatId); }
    finally { setGeneratingFormatId(null); }
  };

  const handleFormatCreated = (fmt: ExamFormat) => {
    setCourseFormats(prev => [...prev.filter(f => f.id !== fmt.id), fmt]);
    setShowSetup(false);
  };

  const handleFormatUpdated = (fmt: ExamFormat) => {
    setCourseFormats(prev => prev.map(f => f.id === fmt.id ? fmt : f));
    setEditingFormatId(null);
  };

  const handleDeleteFormat = async (formatId: string) => {
    await deleteFormat(formatId);
    setCourseFormats(prev => prev.filter(f => f.id !== formatId));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Course header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="h-9 w-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          {course.goal === 'exam_prep'
            ? <GraduationCap className="h-4.5 w-4.5 text-primary-600" />
            : <BookOpen className="h-4.5 w-4.5 text-primary-600" />
          }
        </div>
        <div className="flex-1 min-w-0 text-left" onClick={e => e.stopPropagation()}>
          <CourseEditor course={course} />
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        }
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-100">

          {/* Course structure */}
          {showStructureEditor ? (
            <div className="pt-3">
              <CourseStructureEditor
                course={course}
                onSave={() => setShowStructureEditor(false)}
                onCancel={() => setShowStructureEditor(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowStructureEditor(true)}
              className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
            >
              <Edit3 className="h-3 w-3" />
              Edit subjects &amp; topics
            </button>
          )}

          {loadingFormats ? (
            <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
          ) : courseFormats.length === 0 && !showSetup ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-sm text-gray-400">No exam format set up yet.</p>
            </div>
          ) : (
            <div className="space-y-3 pt-3">
              {courseFormats.map(format => (
                editingFormatId === format.id ? (
                  <FormatEditor
                    key={format.id}
                    format={format}
                    onSave={handleFormatUpdated}
                    onCancel={() => setEditingFormatId(null)}
                  />
                ) : (
                  <FormatCard
                    key={format.id}
                    format={format}
                    onGenerate={() => handleGenerate(format.id)}
                    onStartPractice={() => {
                      setActiveFormat(format);
                      navigate(`/courses/${course.id}/settings`);
                    }}
                    onEdit={() => setEditingFormatId(format.id)}
                    onDelete={() => handleDeleteFormat(format.id)}
                    generating={generatingFormatId === format.id}
                  />
                )
              ))}
            </div>
          )}

          {showSetup ? (
            <FormatSetupPanel
              courseId={course.id}
              examName={course.exam_name}
              onClose={() => setShowSetup(false)}
              onCreated={handleFormatCreated}
            />
          ) : (
            <button
              onClick={() => setShowSetup(true)}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add exam format
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const navigate = useNavigate();
  const { courses, fetchCourses, loading } = useCourseStore();

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage courses and exam formats</p>
          </div>
        </div>
      </div>

      <RubricEditor />

      {loading && courses.length === 0 ? (
        <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No courses yet.</div>
      ) : (
        <div className="space-y-4">
          {courses.map(course => (
            <CourseSection key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
