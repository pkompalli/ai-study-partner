import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useSessionStore } from '@/store/sessionStore';
import type { Subject } from '@/types';

interface SidebarCourseTreeProps {
  subjects: Subject[];
  courseId: string;
  onNavigate?: () => void;
}

export function SidebarCourseTree({ subjects, courseId, onNavigate }: SidebarCourseTreeProps) {
  const navigate = useNavigate();
  const { startSession } = useSessionStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNavigate = async (topicId: string, chapterId?: string) => {
    onNavigate?.();
    const sessionId = await startSession(courseId, topicId, chapterId);
    navigate(`/sessions/${sessionId}`);
  };

  return (
    <div className="space-y-0.5">
      {subjects.map(subject => (
        <div key={subject.id}>
          <button
            onClick={() => toggle(subject.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-100 transition-colors"
          >
            {expanded.has(subject.id)
              ? <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
              : <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
            }
            <span className="text-xs font-semibold text-gray-700 truncate">{subject.name}</span>
          </button>

          {expanded.has(subject.id) && (
            <div className="ml-4 space-y-0.5">
              {subject.topics.map(topic => (
                <div key={topic.id}>
                  <button
                    onClick={() => handleNavigate(topic.id)}
                    className="w-full text-left px-2 py-1 rounded-md text-xs text-primary-700 font-medium hover:bg-primary-50 transition-colors truncate"
                  >
                    {topic.name}
                  </button>
                  <div className="ml-3 space-y-0.5">
                    {topic.chapters.map(chapter => (
                      <button
                        key={chapter.id}
                        onClick={() => handleNavigate(topic.id, chapter.id)}
                        className="w-full text-left px-2 py-0.5 rounded text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors truncate"
                      >
                        • {chapter.name}
                      </button>
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
