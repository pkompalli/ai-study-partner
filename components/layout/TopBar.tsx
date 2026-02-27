'use client'
import { Menu, BookOpen } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';

export function TopBar() {
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const user = useAuthStore(s => s.user);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 md:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </button>

      <div className="flex items-center gap-2 flex-1">
        <BookOpen className="h-5 w-5 text-primary-600" />
        <span className="font-semibold text-gray-900 text-sm">AI Study Partner</span>
      </div>

      <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-medium">
        {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? '?'}
      </div>
    </header>
  );
}
