import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import type { Course } from '@/types';

interface CourseCardProps {
  course: Course;
  onDelete?: (id: string) => void;
}

export function CourseCard({ course, onDelete }: CourseCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link to={`/courses/${course.id}`} className="block">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                {course.goal === 'exam_prep'
                  ? <GraduationCap className="h-4 w-4 text-primary-600" />
                  : <BookOpen className="h-4 w-4 text-primary-600" />
                }
              </div>
              <h3 className="font-semibold text-gray-900 truncate">{course.name}</h3>
            </div>
            {course.description && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">{course.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                {course.goal === 'exam_prep' ? 'Exam Prep' : 'Classwork'}
              </span>
              <span className="text-xs text-gray-400">{formatDate(course.created_at)}</span>
            </div>
          </Link>
        </div>

        {onDelete && (
          <button
            onClick={e => { e.preventDefault(); onDelete(course.id); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </Card>
  );
}
