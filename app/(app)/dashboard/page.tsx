'use client'
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, BookOpen, GraduationCap, Trash2, BarChart2, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useSessionStore } from '@/store/sessionStore';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import api from '@/lib/api';
import type { Course, TopicReadiness } from '@/types';

// ─── Readiness section (lazy-loaded per course) ───────────────────────────────

function ReadinessSection({ courseId }: { courseId: string }) {
  const [readiness, setReadiness] = useState<TopicReadiness[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<TopicReadiness[]>(`/api/exam/readiness/${courseId}`)
      .then(r => setReadiness(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="pt-2"><Spinner className="h-3.5 w-3.5 text-gray-300" /></div>;
  if (readiness.length === 0) return <p className="pt-2 text-xs text-gray-400 italic">No scores yet — start practising</p>;

  return (
    <div className="pt-3 space-y-1.5">
      {readiness.slice(0, 5).map(r => (
        <div key={r.topic_id}>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-gray-600 truncate max-w-[180px]">{r.topic_name}</span>
            <span className={`font-medium ml-2 flex-shrink-0 ${r.readiness_score >= 70 ? 'text-green-600' : r.readiness_score >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
              {r.readiness_score}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${r.readiness_score >= 70 ? 'bg-green-500' : r.readiness_score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${r.readiness_score}%` }}
            />
          </div>
        </div>
      ))}
      {readiness.length > 5 && (
        <p className="text-xs text-gray-400">+{readiness.length - 5} more topics</p>
      )}
    </div>
  );
}

// ─── Course card ──────────────────────────────────────────────────────────────

function CourseCard({
  course, onDelete,
}: {
  course: Course;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();
  const { startSession } = useSessionStore();
  const addToast = useUIStore(s => s.addToast);
  const [scoresOpen, setScoresOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const isExamPrep = course.goal === 'exam_prep';
  const firstTopic = course.subjects?.[0]?.topics?.[0];

  const handleStudy = async () => {
    if (!firstTopic) {
      router.push(`/courses/${course.id}`);
      return;
    }
    setStarting(true);
    try {
      const sessionId = await startSession(course.id, firstTopic.id);
      router.push(`/sessions/${sessionId}`);
    } catch {
      addToast('Failed to start session', 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 hover:shadow-md transition-all duration-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            {isExamPrep
              ? <GraduationCap className="h-4 w-4 text-primary-600" />
              : <BookOpen className="h-4 w-4 text-primary-600" />
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <Link href={`/courses/${course.id}`} className="hover:underline">
              <h3 className="font-semibold text-gray-900 truncate text-sm">{course.name}</h3>
            </Link>
            {course.exam_name && (
              <p className="text-xs text-gray-400 mt-0.5">{course.exam_name}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                {isExamPrep ? 'Exam Prep' : 'Classwork'}
              </span>
              <span className="text-xs text-gray-400">{formatDate(course.created_at)}</span>
            </div>
          </div>

          {/* Delete */}
          {onDelete && (
            <button
              onClick={e => { e.preventDefault(); onDelete(course.id); }}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleStudy}
            disabled={starting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            {starting ? <Spinner className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
            Study
          </button>

          {isExamPrep && (
            <Link
              href={`/courses/${course.id}/settings`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              <GraduationCap className="h-3 w-3" />
              Exam Prep
            </Link>
          )}

          {isExamPrep && (
            <button
              onClick={() => setScoresOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors ml-auto"
            >
              <BarChart2 className="h-3 w-3" />
              Scores
              {scoresOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Readiness scores */}
        {isExamPrep && scoresOpen && (
          <ReadinessSection courseId={course.id} />
        )}
      </div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function Page() {
  const { courses, fetchCourses, deleteCourse, loading } = useCourseStore();
  const user = useAuthStore(s => s.user);
  const addToast = useUIStore(s => s.addToast);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this course and all its sessions?')) return;
    setDeleting(id);
    try {
      await deleteCourse(id);
      addToast('Course deleted', 'success');
    } catch {
      addToast('Failed to delete course', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Your courses and study progress</p>
        </div>
        <Link href="/onboarding">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Course
          </Button>
        </Link>
      </div>

      {/* Courses */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-4xl">📚</p>
          <p className="text-gray-600 font-medium">No courses yet</p>
          <p className="text-sm text-gray-400">Add your first course to start studying</p>
          <Link href="/onboarding">
            <Button className="mt-2">Add Your First Course</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onDelete={deleting === course.id ? undefined : handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
