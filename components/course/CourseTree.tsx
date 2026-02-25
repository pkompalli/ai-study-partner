'use client'
import { useState } from 'react';
import { ChevronDown, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Subject } from '@/types';

interface CourseTreeProps {
  subjects: Subject[];
  onStartSession: (topicId: string, chapterId?: string) => void;
  topicProgress?: Record<string, { status: string }>;
  chapterProgress?: Record<string, { status: string }>;
}

export function CourseTree({ subjects, onStartSession, topicProgress, chapterProgress }: CourseTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([subjects[0]?.id]));

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {subjects.map(subject => (
        <div key={subject.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => toggle(subject.id)}
            className="w-full flex items-center gap-2 p-4 hover:bg-gray-50 transition-colors text-left"
          >
            {expanded.has(subject.id)
              ? <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
              : <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
            }
            <span className="font-semibold text-gray-900 text-sm">{subject.name}</span>
            <span className="ml-auto text-xs text-gray-400">{subject.topics.length} topics</span>
          </button>

          {expanded.has(subject.id) && (
            <div className="divide-y divide-gray-50">
              {subject.topics.map(topic => {
                const topicStatus = topicProgress?.[topic.id]?.status;
                const dot = topicStatus === 'completed' ? 'bg-green-500'
                  : topicStatus === 'in_progress' ? 'bg-amber-400'
                  : 'bg-gray-200';
                return (
                <div key={topic.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 mt-0.5 ${dot}`} />
                      <span className={cn('text-sm', topicStatus === 'in_progress' ? 'text-primary-700 font-medium' : 'text-gray-700')}>{topic.name}</span>
                    </div>
                    <button
                      onClick={() => onStartSession(topic.id)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      Study
                    </button>
                  </div>
                  <div className="space-y-1 pl-2">
                    {topic.chapters.map(chapter => {
                      const chapterStatus = chapterProgress?.[chapter.id]?.status;
                      const chapterDot = chapterStatus === 'completed' ? 'bg-green-500'
                        : chapterStatus === 'in_progress' ? 'bg-amber-400'
                        : 'bg-red-400';
                      return (
                        <div key={chapter.id} className={cn('flex items-center justify-between gap-2 py-1 hover:bg-primary-50/50 rounded cursor-pointer')}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${chapterDot}`} />
                            <span className={cn('text-sm truncate', chapterStatus === 'in_progress' ? 'text-primary-700 font-medium' : 'text-gray-600')}>{chapter.name}</span>
                          </div>
                          <button
                            onClick={() => onStartSession(topic.id, chapter.id)}
                            className="text-xs text-primary-500 hover:text-primary-700 flex-shrink-0"
                          >
                            Start
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
