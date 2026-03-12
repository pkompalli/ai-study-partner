'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSessionStore } from '@/store/sessionStore';
import { useUIStore } from '@/store/uiStore';
import { BookOpen, Brain, Sparkles } from 'lucide-react';

const LOADING_MESSAGES = [
  'Setting up your session...',
  'Preparing your study materials...',
  'Almost ready...',
];

function SessionBootstrapInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startSession = useSessionStore(s => s.startSession);
  const addToast = useUIStore(s => s.addToast);

  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);

  const courseId = searchParams.get('courseId') ?? '';
  const subjectId = searchParams.get('subjectId') ?? undefined;
  const topicId = searchParams.get('topicId') ?? undefined;
  const chapterId = searchParams.get('chapterId') ?? undefined;
  const fallbackHref = courseId ? `/courses/${courseId}` : '/dashboard';

  // Cycle through loading messages
  useEffect(() => {
    if (error) return;
    const timer = setInterval(() => {
      setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [error]);

  const start = useCallback(async () => {
    if (!courseId || (!subjectId && !topicId)) {
      setError('Missing session parameters.');
      return;
    }

    try {
      setError(null);
      const sessionId = await startSession(courseId, subjectId, topicId, chapterId);
      router.replace(`/sessions/${sessionId}`);
    } catch {
      setError('Could not start the session. Please retry.');
      addToast('Failed to start session', 'error');
      startedRef.current = false;
    }
  }, [addToast, chapterId, courseId, router, startSession, subjectId, topicId]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
  }, [start]);

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 space-y-3 text-center">
          <p className="text-sm font-medium text-gray-800">{error}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => {
                startedRef.current = false;
                start();
              }}
              className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
            >
              Retry
            </button>
            <Link
              href={fallbackHref}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5">
      {/* Animated icon stack */}
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-2xl bg-primary-100 animate-ping opacity-20" />
        <div className="relative flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-200">
          <BookOpen className="h-7 w-7 text-white animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-amber-400 shadow">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
      </div>

      {/* Cycling message */}
      <div className="text-center space-y-1.5">
        <p className="text-sm font-medium text-gray-700 transition-opacity duration-300">
          {LOADING_MESSAGES[msgIndex]}
        </p>
        {/* Dot progress */}
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary-400"
              style={{
                animation: 'pulse 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BootstrapSkeleton() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5">
      <div className="relative flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-200">
        <Brain className="h-7 w-7 text-white opacity-60 animate-pulse" />
      </div>
      <p className="text-sm text-gray-400">Preparing session...</p>
    </div>
  );
}

export default function SessionBootstrapPage() {
  return (
    <Suspense fallback={<BootstrapSkeleton />}>
      <SessionBootstrapInner />
    </Suspense>
  );
}
