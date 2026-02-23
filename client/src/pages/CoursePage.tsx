import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, BookOpen } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import { useSessionStore } from '@/store/sessionStore';
import { useUIStore } from '@/store/uiStore';
import { CourseTree } from '@/components/course/CourseTree';
import { Spinner } from '@/components/ui/Spinner';

export function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeCourse, fetchCourse, loading, topicProgress, fetchTopicProgress } = useCourseStore();
  const { startSession } = useSessionStore();
  const addToast = useUIStore(s => s.addToast);

  useEffect(() => {
    if (id) {
      fetchCourse(id);
      fetchTopicProgress(id).catch(() => {});
    }
  }, [id, fetchCourse, fetchTopicProgress]);

  const handleStartSession = async (topicId: string, chapterId?: string) => {
    if (!id) return;
    try {
      const sessionId = await startSession(id, topicId, chapterId);
      navigate(`/sessions/${sessionId}`);
    } catch {
      addToast('Failed to start session', 'error');
    }
  };

  if (loading || !activeCourse) {
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
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </button>

        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            {activeCourse.goal === 'exam_prep'
              ? <GraduationCap className="h-5 w-5 text-primary-600" />
              : <BookOpen className="h-5 w-5 text-primary-600" />
            }
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{activeCourse.name}</h1>
            {activeCourse.description && (
              <p className="text-sm text-gray-500 mt-0.5">{activeCourse.description}</p>
            )}
            <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
              {activeCourse.goal === 'exam_prep' ? 'Exam Prep' : 'Classwork'}
            </span>
          </div>
        </div>
      </div>

      {/* Course tree */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Course Structure</h2>
        {activeCourse.subjects && activeCourse.subjects.length > 0 ? (
          <CourseTree subjects={activeCourse.subjects} onStartSession={handleStartSession} topicProgress={topicProgress} />
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No topics found</p>
        )}
      </div>
    </div>
  );
}
