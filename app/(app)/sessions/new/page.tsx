'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { useSessionStore } from '@/store/sessionStore';
import { useUIStore } from '@/store/uiStore';

function SessionBootstrapInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startSession = useSessionStore(s => s.startSession);
  const addToast = useUIStore(s => s.addToast);

  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const courseId = searchParams.get('courseId') ?? '';
  const topicId = searchParams.get('topicId') ?? '';
  const chapterId = searchParams.get('chapterId') ?? undefined;
  const fallbackHref = courseId ? `/courses/${courseId}` : '/dashboard';

  const start = useCallback(async () => {
    if (!courseId || !topicId) {
      setError('Missing session parameters.');
      return;
    }

    try {
      setError(null);
      const sessionId = await startSession(courseId, topicId, chapterId);
      router.replace(`/sessions/${sessionId}`);
    } catch {
      setError('Could not start the session. Please retry.');
      addToast('Failed to start session', 'error');
      startedRef.current = false;
    }
  }, [addToast, chapterId, courseId, router, startSession, topicId]);

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
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-gray-500">Starting your study session...</p>
    </div>
  );
}

export default function SessionBootstrapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-gray-500">Preparing session...</p>
        </div>
      }
    >
      <SessionBootstrapInner />
    </Suspense>
  );
}
