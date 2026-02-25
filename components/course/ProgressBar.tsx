'use client'
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
  label?: string;
}

export function ProgressBar({ value, className, label }: ProgressBarProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
      )}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
