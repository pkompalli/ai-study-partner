'use client'
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-current opacity-70"
          style={{ animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
