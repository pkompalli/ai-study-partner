'use client'
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { to: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" />, label: 'Dashboard' },
  { to: '/onboarding', icon: <Plus className="h-5 w-5" />, label: 'New Course' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 flex md:hidden">
      {items.map(item => (
        <Link
          key={item.to}
          href={item.to}
          className={cn(
            'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
            pathname === item.to ? 'text-primary-600' : 'text-gray-500'
          )}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
