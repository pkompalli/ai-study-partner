import { useState } from 'react';
import { ChevronDown, ChevronRight, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Subject } from '@/types';

interface CourseTreeProps {
  subjects: Subject[];
  onStartSession: (topicId: string, chapterId?: string) => void;
}

export function CourseTree({ subjects, onStartSession }: CourseTreeProps) {
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
        <div key={subject.id} className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggle(subject.id)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
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
              {subject.topics.map(topic => (
                <div key={topic.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-800">{topic.name}</span>
                    <button
                      onClick={() => onStartSession(topic.id)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium hover:bg-primary-100 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      Study
                    </button>
                  </div>
                  <div className="space-y-1 pl-2">
                    {topic.chapters.map(chapter => (
                      <div key={chapter.id} className={cn('flex items-center justify-between gap-2 py-1')}>
                        <span className="text-xs text-gray-500">• {chapter.name}</span>
                        <button
                          onClick={() => onStartSession(topic.id, chapter.id)}
                          className="text-xs text-primary-500 hover:text-primary-700"
                        >
                          Start
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
