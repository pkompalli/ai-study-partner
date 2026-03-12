'use client'
import { Sparkles } from 'lucide-react';

export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="relative flex items-center justify-center h-5 w-5">
        <Sparkles className="h-3.5 w-3.5 text-primary-500 animate-pulse" />
        <div className="absolute inset-0 rounded-full bg-primary-400/20 animate-ping" />
      </div>
      <span className="text-xs font-medium text-primary-600">Thinking...</span>
      <div className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-1 w-1 bg-primary-400 rounded-full"
            style={{ animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
