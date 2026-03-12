'use client'
import { Minus, Plus, ChevronDown, ChevronUp, RotateCcw, BookOpen, Sparkles } from 'lucide-react';
import { StreamingMarkdown } from '@/components/ui/StreamingMarkdown';

const DEPTH_LABELS: Record<number, string> = {
  1: 'Key Points',
  2: 'Overview',
  3: 'Explained',
  4: 'In Depth',
  5: 'Textbook',
};

interface TopicSummaryProps {
  summary: string;
  isStreaming: boolean;
  streamingContent: string;
  collapsed: boolean;
  onToggle: () => void;
  depth: number;
  onDepthChange: (newDepth: number) => void;
  onRefresh: () => void;
}

export function TopicSummary({
  summary,
  isStreaming,
  streamingContent,
  collapsed,
  onToggle,
  depth,
  onDepthChange,
  onRefresh,
}: TopicSummaryProps) {
  return (
    <div className="my-4 rounded-2xl border border-primary-100 bg-primary-50/40 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-100 bg-primary-50">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary-800 hover:text-primary-900 transition-colors"
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          Topic Overview
        </button>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary-500 animate-pulse" />
              <span className="text-[10px] text-primary-500 font-medium">Writing</span>
            </div>
          )}
          <span className="text-xs text-primary-500 font-medium">{DEPTH_LABELS[depth]}</span>
          <button
            onClick={onRefresh}
            disabled={isStreaming}
            className="h-6 w-6 rounded-md flex items-center justify-center text-primary-500 hover:bg-primary-100 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Regenerate"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onDepthChange(depth - 1)}
              disabled={depth <= 1 || isStreaming}
              className="h-6 w-6 rounded-md flex items-center justify-center text-primary-600 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Less depth"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDepthChange(depth + 1)}
              disabled={depth >= 5 || isStreaming}
              className="h-6 w-6 rounded-md flex items-center justify-center text-primary-600 hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="More depth"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Content — hidden when collapsed */}
      {!collapsed && (
        <div className="px-4 py-4">
          {isStreaming && !streamingContent ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md shadow-primary-200">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-amber-400 flex items-center justify-center">
                  <Sparkles className="h-2 w-2 text-white" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-primary-700">Crafting your lesson</p>
                <p className="text-xs text-gray-400">Personalizing depth level {depth}...</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-primary-400"
                    style={{ animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          ) : isStreaming ? (
            /* Block-memoized markdown during streaming — smooth, no full re-render */
            <StreamingMarkdown content={streamingContent} isStreaming />
          ) : (
            <StreamingMarkdown content={summary} />
          )}
        </div>
      )}
    </div>
  );
}
