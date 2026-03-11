'use client'
import { useState, useRef } from 'react';
import {
  ChevronDown, ChevronRight, Edit3, Check, X,
  Plus, Trash2, ArrowUp, ArrowDown, Sparkles, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import api from '@/lib/api';
import type { Subject, Topic, Chapter } from '@/types';

interface StructurePreviewStepProps {
  structure: { subjects: Subject[]; name?: string; description?: string };
  onConfirm: (structure: { subjects: Subject[] }) => void;
  loading?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let _counter = 0;
function tempId() {
  return `temp_${Date.now()}_${++_counter}`;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((x, i) => ({ ...x, sort_order: i }));
}

// ── Inline editable name ─────────────────────────────────────────────────────

function InlineEdit({
  value, onSave, className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    if (draft.trim()) onSave(draft.trim());
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className={`group flex items-center gap-1.5 text-left min-w-0 ${className ?? ''}`}
        title="Click to edit"
      >
        <span className="truncate">{value}</span>
        <Edit3 className="h-3 w-3 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="flex-1 min-w-0 px-2 py-0.5 rounded border border-primary-300 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
        autoFocus
      />
      <button onClick={commit} className="text-green-600 hover:text-green-700 flex-shrink-0">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Move buttons ─────────────────────────────────────────────────────────────

function MoveButtons({ index, count, onMove }: { index: number; count: number; onMove: (from: number, to: number) => void }) {
  if (count <= 1) return null;
  return (
    <span className="inline-flex gap-0.5 flex-shrink-0">
      <button disabled={index === 0} onClick={() => onMove(index, index - 1)}
        className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30">
        <ArrowUp className="h-3 w-3" />
      </button>
      <button disabled={index === count - 1} onClick={() => onMove(index, index + 1)}
        className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30">
        <ArrowDown className="h-3 w-3" />
      </button>
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function StructurePreviewStep({ structure, onConfirm, loading }: StructurePreviewStepProps) {
  const [subjects, setSubjects] = useState<Subject[]>(structure.subjects ?? []);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(structure.subjects?.[0]?.id ? [structure.subjects[0].id] : []));
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // AI refinement
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);

  // ── Toggle helpers ───────────────────────────────────────────────────────

  const toggle = (id: string, setter: typeof setExpanded) =>
    setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Subject operations ───────────────────────────────────────────────────

  const updateSubject = (si: number, patch: Partial<Subject>) =>
    setSubjects(prev => prev.map((s, i) => i === si ? { ...s, ...patch } : s));

  const addSubject = () => {
    const s: Subject = { id: tempId(), name: 'New Subject', sort_order: subjects.length, topics: [] };
    setSubjects(prev => [...prev, s]);
    setExpanded(prev => new Set(prev).add(s.id));
  };

  const removeSubject = (si: number) => setSubjects(prev => prev.filter((_, i) => i !== si));

  const moveSubject = (from: number, to: number) => setSubjects(prev => moveItem(prev, from, to));

  // ── Topic operations ─────────────────────────────────────────────────────

  const updateTopic = (si: number, ti: number, patch: Partial<Topic>) =>
    updateSubject(si, {
      topics: subjects[si].topics.map((t, i) => i === ti ? { ...t, ...patch } : t),
    });

  const addTopic = (si: number) => {
    const t: Topic = { id: tempId(), name: 'New Topic', sort_order: subjects[si].topics.length, chapters: [] };
    updateSubject(si, { topics: [...subjects[si].topics, t] });
    setExpandedTopics(prev => new Set(prev).add(t.id));
  };

  const removeTopic = (si: number, ti: number) =>
    updateSubject(si, { topics: subjects[si].topics.filter((_, i) => i !== ti) });

  const moveTopic = (si: number, from: number, to: number) =>
    updateSubject(si, { topics: moveItem(subjects[si].topics, from, to) });

  // ── Chapter operations ───────────────────────────────────────────────────

  const updateChapter = (si: number, ti: number, ci: number, patch: Partial<Chapter>) =>
    updateTopic(si, ti, {
      chapters: subjects[si].topics[ti].chapters.map((c, i) => i === ci ? { ...c, ...patch } : c),
    });

  const addChapter = (si: number, ti: number) => {
    const c: Chapter = { id: tempId(), name: 'New Chapter', sort_order: subjects[si].topics[ti].chapters.length };
    updateTopic(si, ti, { chapters: [...subjects[si].topics[ti].chapters, c] });
  };

  const removeChapter = (si: number, ti: number, ci: number) =>
    updateTopic(si, ti, { chapters: subjects[si].topics[ti].chapters.filter((_, i) => i !== ci) });

  const moveChapter = (si: number, ti: number, from: number, to: number) =>
    updateTopic(si, ti, { chapters: moveItem(subjects[si].topics[ti].chapters, from, to) });

  // ── AI refinement ────────────────────────────────────────────────────────

  const handleRefine = async () => {
    if (!feedback.trim() || refining) return;
    setRefining(true);
    try {
      const { data } = await api.post<{ structure: { name?: string; description?: string; subjects: Subject[] } }>(
        '/api/courses/extract/refine',
        { structure: { name: structure.name, description: structure.description, subjects }, feedback },
      );
      if (data.structure?.subjects?.length) {
        setSubjects(data.structure.subjects);
        setFeedback('');
        // Expand first subject
        if (data.structure.subjects[0]?.id) {
          setExpanded(new Set([data.structure.subjects[0].id]));
        }
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setRefining(false);
    }
  };

  // ── Count summary ────────────────────────────────────────────────────────

  const topicCount = subjects.reduce((s, sub) => s + sub.topics.length, 0);
  const chapterCount = subjects.reduce((s, sub) => s + sub.topics.reduce((t, top) => t + top.chapters.length, 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Review your course structure</h2>
        <p className="text-sm text-gray-600 mt-1">
          Edit names, add or remove items, reorder, or ask AI to refine the structure.
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span>{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</span>
          <span>{topicCount} topic{topicCount !== 1 ? 's' : ''}</span>
          <span>{chapterCount} chapter{chapterCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Structure tree ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
        {subjects.map((subject, si) => (
          <div key={subject.id}>
            {/* Subject row */}
            <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-50 group">
              <button onClick={() => toggle(subject.id, setExpanded)} className="flex-shrink-0 p-0.5">
                {expanded.has(subject.id)
                  ? <ChevronDown className="h-4 w-4 text-gray-400" />
                  : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </button>
              <InlineEdit
                value={subject.name}
                onSave={v => updateSubject(si, { name: v })}
                className="flex-1 font-semibold text-sm text-gray-900"
              />
              <MoveButtons index={si} count={subjects.length} onMove={moveSubject} />
              <button onClick={() => removeSubject(si)} className="p-0.5 text-gray-300 hover:text-red-500 flex-shrink-0"
                title="Remove subject">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Topics under subject */}
            {expanded.has(subject.id) && (
              <div className="divide-y divide-gray-50">
                {subject.topics.map((topic, ti) => (
                  <div key={topic.id}>
                    {/* Topic row */}
                    <div className="flex items-center gap-1.5 pl-8 pr-3 py-2 group">
                      <button onClick={() => toggle(topic.id, setExpandedTopics)} className="flex-shrink-0 p-0.5">
                        {topic.chapters.length > 0 ? (
                          expandedTopics.has(topic.id)
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                        ) : <span className="w-3.5" />}
                      </button>
                      <InlineEdit
                        value={topic.name}
                        onSave={v => updateTopic(si, ti, { name: v })}
                        className="flex-1 text-sm text-gray-700"
                      />
                      <MoveButtons index={ti} count={subject.topics.length} onMove={(f, t) => moveTopic(si, f, t)} />
                      <button onClick={() => removeTopic(si, ti)} className="p-0.5 text-gray-300 hover:text-red-500 flex-shrink-0"
                        title="Remove topic">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Chapters under topic */}
                    {expandedTopics.has(topic.id) && topic.chapters.length > 0 && (
                      <div className="pl-16 pr-3 pb-1 space-y-0.5">
                        {topic.chapters.map((ch, ci) => (
                          <div key={ch.id} className="flex items-center gap-1.5 py-0.5 group">
                            <span className="text-gray-300 text-xs flex-shrink-0">-</span>
                            <InlineEdit
                              value={ch.name}
                              onSave={v => updateChapter(si, ti, ci, { name: v })}
                              className="flex-1 text-xs text-gray-500"
                            />
                            <MoveButtons index={ci} count={topic.chapters.length} onMove={(f, t) => moveChapter(si, ti, f, t)} />
                            <button onClick={() => removeChapter(si, ti, ci)} className="p-0.5 text-gray-300 hover:text-red-500 flex-shrink-0"
                              title="Remove chapter">
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                        <button onClick={() => addChapter(si, ti)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 py-0.5 pl-3">
                          <Plus className="h-2.5 w-2.5" /> Add chapter
                        </button>
                      </div>
                    )}

                    {/* Add chapter button when topic is expanded but has no chapters */}
                    {expandedTopics.has(topic.id) && topic.chapters.length === 0 && (
                      <div className="pl-16 pr-3 pb-1">
                        <button onClick={() => addChapter(si, ti)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 py-0.5">
                          <Plus className="h-2.5 w-2.5" /> Add chapter
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add topic button */}
                <div className="pl-8 pr-3 py-1.5">
                  <button onClick={() => addTopic(si)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600">
                    <Plus className="h-3 w-3" /> Add topic
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add subject */}
      <button onClick={addSubject}
        className="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Add subject
      </button>

      {/* ── AI refinement ───────────────────────────────────────────────── */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
          <Sparkles className="h-3.5 w-3.5 text-primary-500" />
          Ask AI to refine the structure
        </div>
        <div className="flex gap-2">
          <input
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
            placeholder='e.g. "Split Topic 3 into two", "Add a chapter on recursion", "Remove the last subject"'
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400 bg-white"
            disabled={refining}
          />
          <button
            onClick={handleRefine}
            disabled={!feedback.trim() || refining}
            className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {refining ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            Refine
          </button>
        </div>
      </div>

      {/* ── Confirm ─────────────────────────────────────────────────────── */}
      <Button
        onClick={() => onConfirm({ subjects })}
        loading={loading}
        disabled={subjects.length === 0 || subjects.every(s => s.topics.length === 0)}
        className="w-full"
      >
        Save Course & Start Studying
      </Button>
    </div>
  );
}
