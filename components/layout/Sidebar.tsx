'use client'
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, LogOut, BookOpen, ChevronDown, ChevronRight, GraduationCap, Settings, LayoutDashboard } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useCourseStore } from '@/store/courseStore';
import { useSessionStore } from '@/store/sessionStore';
import { SidebarCourseTree } from '@/components/session/SidebarCourseTree';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const { signOut, user } = useAuthStore();
  const { courses, activeCourse, loading } = useCourseStore();
  const activeSession = useSessionStore(s => s.activeSession);

  // Track which courses are expanded
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expand the currently active course (e.g. when on a session page)
  useEffect(() => {
    if (activeCourse?.id) {
      setExpanded(prev => new Set([...prev, activeCourse.id]));
    }
  }, [activeCourse?.id]);

  // Auto-expand the first course when courses first load and nothing is expanded
  useEffect(() => {
    if (courses.length > 0 && expanded.size === 0) {
      setExpanded(new Set([courses[0].id]));
    }
  }, [courses.length]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const closeMobile = () => setSidebarOpen(false);

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100 z-40 flex flex-col transition-transform duration-200',
        'md:translate-x-0 md:static md:flex',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo — click goes to Dashboard */}
      <Link href="/dashboard" onClick={closeMobile} className="p-4 border-b border-gray-100 flex items-center gap-2 flex-shrink-0 hover:bg-gray-50 transition-colors">
        <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-gray-900">Study Partner</span>
      </Link>

      {/* Courses section — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Top nav links */}
        <div className="px-2 pt-2 pb-1 space-y-0.5">
          <Link
            href="/dashboard"
            onClick={closeMobile}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Dashboard</span>
          </Link>
          <Link
            href="/settings"
            onClick={closeMobile}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Settings</span>
          </Link>
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between px-4 pt-1 pb-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Courses</span>
          <Link
            href="/onboarding"
            onClick={closeMobile}
            className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
            title="Add new course"
          >
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Course list */}
        {loading && courses.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-400">Loading courses…</div>
        ) : courses.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-500 leading-relaxed">
            No courses yet.{' '}
            <Link
              href="/onboarding"
              onClick={closeMobile}
              className="text-primary-600 hover:underline font-medium"
            >
              Add your first course
            </Link>
          </div>
        ) : (
          <div className="px-2 pb-3 space-y-0.5">
            {courses.map(course => (
              <div key={course.id}>
                {/* Course header row: chevron + name (link) + settings icon */}
                <div className={cn(
                  'flex items-center rounded-lg transition-colors',
                  activeCourse?.id === course.id ? 'bg-primary-50' : 'hover:bg-gray-50'
                )}>
                  <button
                    onClick={() => toggle(course.id)}
                    className="p-1.5 flex-shrink-0 rounded-lg"
                  >
                    {expanded.has(course.id)
                      ? <ChevronDown className="h-3 w-3 text-gray-400" />
                      : <ChevronRight className="h-3 w-3 text-gray-400" />
                    }
                  </button>
                  <Link
                    href={`/courses/${course.id}`}
                    onClick={closeMobile}
                    className={cn(
                      'flex items-center gap-1.5 py-1.5 flex-1 min-w-0 transition-colors',
                      activeCourse?.id === course.id ? 'text-primary-800' : 'text-gray-700'
                    )}
                  >
                    {course.goal === 'exam_prep'
                      ? <GraduationCap className="h-3.5 w-3.5 text-primary-500 flex-shrink-0" />
                      : <BookOpen className="h-3.5 w-3.5 text-primary-500 flex-shrink-0" />
                    }
                    <span className="text-xs font-semibold truncate">{course.name}</span>
                  </Link>
                  <Link
                    href="/settings"
                    onClick={closeMobile}
                    title="Settings & exam formats"
                    className="p-1.5 flex-shrink-0 text-gray-300 hover:text-gray-600 transition-colors"
                  >
                    <Settings className="h-3 w-3" />
                  </Link>
                </div>

                {/* Expanded tree */}
                {expanded.has(course.id) && course.subjects && course.subjects.length > 0 && (
                  <div className="ml-3 mt-0.5 mb-1 border-l border-gray-100 pl-2">
                    <SidebarCourseTree
                      subjects={course.subjects}
                      courseId={course.id}
                      activeTopicId={activeSession?.course_id === course.id ? activeSession?.topic_id : undefined}
                      onNavigate={closeMobile}
                    />
                  </div>
                )}

                {expanded.has(course.id) && (!course.subjects || course.subjects.length === 0) && (
                  <p className="ml-6 px-2 py-1 text-xs text-gray-400">No topics found</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User + sign out */}
      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-medium flex-shrink-0">
            {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.name ?? user?.email ?? 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
