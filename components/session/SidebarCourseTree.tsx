'use client'
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [startingSessionKey, setStartingSessionKey] = useState<string | null>(null);
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const routeKeyAtNavigateRef = useRef(routeKey);

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

  // Reset transient loading indicator once navigation settles to a new route/query.
  useEffect(() => {
    if (!startingSessionKey) return;
    if (routeKey === routeKeyAtNavigateRef.current) return;
    setStartingSessionKey(null);
  }, [routeKey, startingSessionKey]);

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
    routeKeyAtNavigateRef.current = routeKey;
    setStartingSessionKey(key);
    router.push(buildSessionStartRoute({ courseId, topicId, chapterId }));
  };

  const handleSubjectNavigate = (subject: Subject) => {
    // Navigate to the first topic under this subject
    const firstTopic = subject.topics[0];
    if (!firstTopic) return;
    handleNavigate(firstTopic.id);
    // Also expand the subject to show its topics
    setExpanded(prev => new Set([...prev, subject.id]));
  };

  return (
    <div className="space-y-0.5">
      {subjects.map(subject => {
        // Subject is "active" when the current session's topic belongs to it
        const isSubjectActive = subject.topics.some(t => t.id === activeTopicId);
        const isSubjectStarting = subject.topics.some(t => startingSessionKey === t.id);
        return (
        <div key={subject.id}>
          <div className="flex items-center">
            <button
              onClick={() => toggle(subject.id)}
              className="p-1 flex-shrink-0 rounded"
            >
              {expanded.has(subject.id)
                ? <ChevronDown className="h-3 w-3 text-primary-400" />
                : <ChevronRight className="h-3 w-3 text-primary-400" />
              }
            </button>
            <button
              onClick={() => handleSubjectNavigate(subject)}
              disabled={Boolean(startingSessionKey) || subject.topics.length === 0}
              className={`flex-1 text-left px-1 py-1.5 rounded-md text-xs font-semibold truncate transition-colors ${
                isSubjectActive
                  ? 'text-white'
                  : 'text-primary-200 hover:text-white hover:bg-primary-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="truncate">{subject.name}</span>
                {isSubjectStarting && <Loader2 className="h-3 w-3 animate-spin text-primary-300 flex-shrink-0" />}
              </span>
            </button>
          </div>

          {expanded.has(subject.id) && (
            <div className="ml-4 space-y-0.5">
              {subject.topics.map(topic => {
                const isTopicStarting = startingSessionKey === topic.id;
                return (
                  <div key={topic.id}>
                    <button
                      onClick={() => handleNavigate(topic.id)}
                      disabled={Boolean(startingSessionKey)}
                      className={`w-full text-left px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        topic.id === activeTopicId
                          ? 'text-white bg-primary-700/50'
                          : 'text-primary-200 hover:text-white hover:bg-primary-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate">{topic.name}</span>
                        {isTopicStarting && <Loader2 className="h-3 w-3 animate-spin text-primary-300 flex-shrink-0" />}
                      </span>
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
                            className={`w-full text-left px-2 py-0.5 rounded text-xs transition-colors ${
                              isActiveChapter
                                ? 'text-white bg-primary-700/50 font-medium'
                                : 'text-primary-200 hover:text-white hover:bg-primary-800'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="truncate">• {chapter.name}</span>
                              {isChapterStarting && <Loader2 className="h-3 w-3 animate-spin text-primary-300 flex-shrink-0" />}
                            </span>
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
        );
      })}
    </div>
  );
}
