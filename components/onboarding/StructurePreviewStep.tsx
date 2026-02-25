'use client'
import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit3, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Subject } from '@/types';

interface StructurePreviewStepProps {
  structure: { subjects: Subject[] };
  onConfirm: (structure: { subjects: Subject[] }) => void;
  loading?: boolean;
}

export function StructurePreviewStep({ structure, onConfirm, loading }: StructurePreviewStepProps) {
  const [subjects, setSubjects] = useState(structure.subjects ?? []);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set([0]));
  const [editingSubject, setEditingSubject] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const toggleSubject = (idx: number) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const startEdit = (idx: number, name: string) => {
    setEditingSubject(idx);
    setEditValue(name);
  };

  const saveEdit = (idx: number) => {
    setSubjects(prev => prev.map((s, i) => i === idx ? { ...s, name: editValue } : s));
    setEditingSubject(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Review your course structure</h2>
        <p className="text-sm text-gray-600 mt-1">AI has extracted this structure. You can edit names before saving.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
        {subjects.map((subject, si) => (
          <div key={si}>
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
              <button onClick={() => toggleSubject(si)} className="flex-shrink-0">
                {expandedSubjects.has(si)
                  ? <ChevronDown className="h-4 w-4 text-gray-500" />
                  : <ChevronRight className="h-4 w-4 text-gray-500" />
                }
              </button>

              {editingSubject === si ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="flex-1 px-2 py-1 rounded border border-primary-300 text-sm focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => saveEdit(si)} className="text-green-600">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingSubject(null)} className="text-gray-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 font-semibold text-gray-900">{subject.name}</span>
                  <button onClick={() => startEdit(si, subject.name)} className="text-gray-400 hover:text-gray-600">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            {expandedSubjects.has(si) && (
              <div className="divide-y divide-gray-50">
                {subject.topics.map((topic, ti) => (
                  <div key={ti} className="pl-10 pr-4 py-2">
                    <p className={cn('text-sm text-gray-600 hover:bg-gray-50 rounded px-1')}>{topic.name}</p>
                    <div className="mt-1 space-y-0.5">
                      {topic.chapters.map((ch, ci) => (
                        <p key={ci} className="text-xs text-gray-500 pl-4">• {ch.name}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Button
        onClick={() => onConfirm({ subjects })}
        loading={loading}
        className="w-full"
      >
        Save Course & Start Studying
      </Button>
    </div>
  );
}
