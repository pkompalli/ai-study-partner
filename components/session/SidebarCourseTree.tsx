'use client'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Subject } from '@/types';
import { buildSessionStartRoute } from '@/lib/sessionStartRoute';

interface SidebarCourseTreeProps {
  subjects: Subject[];
  courseId: string;
  activeTopicId?: string;
  activeChapterId?: string;
  onNavigate?: () => void;
}

export function SidebarCourseTree({ subjects, courseId, activeTopicId, activeChapterId, onNavigate }: SidebarCourseTreeProps) {
  const router = useRouter();
  const [startingSessionKey, setStartingSessionKey] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand the subject (and optionally expose the topic) containing the active chapter or topic
    const matchSubject = subjects.find(s =>
      s.topics.some(t =>
        t.id === activeTopicId ||
        (activeChapterId && t.chapters.some(c => c.id === activeChapterId))
      )
    );
    return matchSubject ? new Set([matchSubject.id]) : new Set();
  });

  // Keep the active subject expanded if active ids change after mount
  useEffect(() => {
    const matchSubject = subjects.find(s =>
      s.topics.some(t =>
        t.id === activeTopicId ||
        (activeChapterId && t.chapters.some(c => c.id === activeChapterId))
      )
    );
    if (matchSubject) {
      setExpanded(prev => prev.has(matchSubject.id) ? prev : new Set([...prev, matchSubject.id]));
    }
  }, [activeTopicId, activeChapterId, subjects]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNavigate = (topicId: string, chapterId?: string) => {
    const key = chapterId ? `${topicId}:${chapterId}` : topicId;
    onNavigate?.();
    setStartingSessionKey(key);
    router.push(buildSessionStartRoute({ courseId, topicId, chapterId }));
  };

  return (
    <div className="space-y-0.5">
      {subjects.map(subject => (
        <div key={subject.id}>
          <button
            onClick={() => toggle(subject.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-primary-800 transition-colors"
          >
            {expanded.has(subject.id)
              ? <ChevronDown className="h-3 w-3 text-primary-400 flex-shrink-0" />
              : <ChevronRight className="h-3 w-3 text-primary-400 flex-shrink-0" />
            }
            <span className="text-xs font-semibold text-primary-200 truncate">{subject.name}</span>
          </button>

          {expanded.has(subject.id) && (
            <div className="ml-4 space-y-0.5">
              {subject.topics.map(topic => {
                const isTopicStarting = startingSessionKey === topic.id;
                return (
                  <div key={topic.id}>
                    <button
                      onClick={() => handleNavigate(topic.id)}
                      disabled={Boolean(startingSessionKey)}
                      className={`w-full text-left px-2 py-1 rounded-md text-xs font-medium transition-colors truncate block ${
                        topic.id === activeTopicId
                          ? 'text-white bg-primary-700/50'
                          : 'text-primary-200 hover:text-white hover:bg-primary-800'
                      }`}
                    >
                      {isTopicStarting ? `${topic.name} (opening...)` : topic.name}
                    </button>
                    <div className="ml-3 space-y-0.5">
                      {topic.chapters.map(chapter => {
                        const isActiveChapter = chapter.id === activeChapterId;
                        const isChapterStarting = startingSessionKey === `${topic.id}:${chapter.id}`;
                        return (
                          <button
                            key={chapter.id}
                            onClick={() => handleNavigate(topic.id, chapter.id)}
                            disabled={Boolean(startingSessionKey)}
                            className={`w-full text-left px-2 py-0.5 rounded text-xs transition-colors truncate block ${
                              isActiveChapter
                                ? 'text-white bg-primary-700/50 font-medium'
                                : 'text-primary-200 hover:text-white hover:bg-primary-800'
                            }`}
                          >
                            • {isChapterStarting ? `${chapter.name} (opening...)` : chapter.name}
                          </button>
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
