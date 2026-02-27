'use client'
import { Minus, Plus, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
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
          {isStreaming && <Spinner className="h-3.5 w-3.5 text-primary-500" />}
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
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-6 w-6 text-primary-400" />
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
