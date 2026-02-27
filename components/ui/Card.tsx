'use client'
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-white rounded-xl border border-gray-100 shadow-sm p-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
