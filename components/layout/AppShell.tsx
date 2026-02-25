'use client'
import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { ToastContainer } from '@/components/ui/Toast';
import { useUIStore } from '@/store/uiStore';
import { useCourseStore } from '@/store/courseStore';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const fetchCourses = useCourseStore(s => s.fetchCourses);

  // Load courses once on app shell mount so sidebar always has data
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Close sidebar on resize to desktop
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [setSidebarOpen]);

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
        <BottomNav />
      </div>

      <ToastContainer />
    </div>
  );
}
