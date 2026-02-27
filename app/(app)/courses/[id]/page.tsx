'use client'
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap, BookOpen, Settings } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import { CourseTree } from '@/components/course/CourseTree';
import { Spinner } from '@/components/ui/Spinner';
import { buildSessionStartRoute } from '@/lib/sessionStartRoute';

export default function Page() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { activeCourse, fetchCourse, topicProgress, chapterProgress, fetchTopicProgress } = useCourseStore();
  const [initializing, setInitializing] = useState(true);
  const [startingSessionKey, setStartingSessionKey] = useState<string | null>(null);

  const course = activeCourse?.id === id ? activeCourse : null;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    router.prefetch('/sessions/new');

    if (!course) {
      setInitializing(true);
      fetchCourse(id).finally(() => {
        if (!cancelled) setInitializing(false);
      });
    } else {
      setInitializing(false);
    }

    fetchTopicProgress(id).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id, course, fetchCourse, fetchTopicProgress, router]);

  const handleStartSession = (topicId: string, chapterId?: string) => {
    if (!id) return;
    const key = chapterId ? `${topicId}:${chapterId}` : topicId;
    setStartingSessionKey(key);
    router.push(buildSessionStartRoute({ courseId: id, topicId, chapterId }));
  };

  if (initializing && !course) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </button>

        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            {course?.goal === 'exam_prep'
              ? <GraduationCap className="h-5 w-5 text-primary-600" />
              : <BookOpen className="h-5 w-5 text-primary-600" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{course?.name ?? 'Course'}</h1>
            {course?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{course.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                {course?.goal === 'exam_prep' ? 'Exam Prep' : 'Classwork'}
              </span>
              {course?.exam_name && (
                <span className="text-xs text-gray-400">{course.exam_name}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push(`/courses/${id}/settings`)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            title="Course settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Course tree */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Course Structure</h2>
        {course?.subjects && course.subjects.length > 0 ? (
          <CourseTree
            subjects={course.subjects}
            onStartSession={handleStartSession}
            topicProgress={topicProgress}
            chapterProgress={chapterProgress}
            startingSessionKey={startingSessionKey}
          />
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No topics found</p>
        )}
      </div>
    </div>
  );
}
