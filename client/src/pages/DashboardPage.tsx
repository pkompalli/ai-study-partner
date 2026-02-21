import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCourseStore } from '@/store/courseStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { CourseCard } from '@/components/course/CourseCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

export function DashboardPage() {
  const { courses, fetchCourses, deleteCourse, loading } = useCourseStore();
  const user = useAuthStore(s => s.user);
  const addToast = useUIStore(s => s.addToast);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

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
            {user?.name ? `Hi, ${user.name.split(' ')[0]} 👋` : 'Dashboard'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Your courses and study sessions</p>
        </div>
        <Link to="/onboarding">
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
          <Link to="/onboarding">
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
