'use client'
import { useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';
import { StreamingMarkdown } from '@/components/ui/StreamingMarkdown';
import type { SessionMessage } from '@/types';

interface ChatWindowProps {
  messages: SessionMessage[];
  isStreaming: boolean;
  streamingContent: string;
  regeneratingIndex: number | null;
  onRegenerate: (visibleIndex: number, depth: number) => void;
}

export function ChatWindow({
  messages,
  isStreaming,
  streamingContent,
  regeneratingIndex,
  onRegenerate,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const visibleMessages = messages.filter(m => m.role !== 'system');

  return (
    <div className="py-4 space-y-4">
      {visibleMessages.map((message, visibleIdx) => {
        const isAssistant = message.role === 'assistant';
        const isBeingRegenerated = regeneratingIndex === visibleIdx;
        const currentDepth = message.depth ?? 3;

        // Regenerating in-place: block-memoized markdown with cursor — no flicker
        if (isAssistant && isBeingRegenerated && isStreaming) {
          return (
            <div key={visibleIdx} className="flex gap-2 justify-start">
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0 mt-1">
                AI
              </div>
              {streamingContent ? (
                <div className="flex-1 min-w-0 rounded-2xl rounded-bl-md px-4 py-3 bg-white border border-gray-100 shadow-sm">
                  <StreamingMarkdown content={streamingContent} isStreaming />
                </div>
              ) : (
                <StreamingIndicator />
              )}
            </div>
          );
        }

        // AI text message
        if (isAssistant && message.content_type === 'text') {
          return (
            <div key={visibleIdx} className="flex gap-2 justify-start">
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0 mt-1">
                AI
              </div>

              <div className="relative flex-1 min-w-0">
                <div className="rounded-2xl rounded-bl-md px-4 py-3 pr-16 bg-white border border-gray-100 text-gray-900 shadow-sm">
                  <StreamingMarkdown content={message.content} />
                </div>

                {/* Depth controls — always visible, top-right */}
                <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-1.5 py-1">
                  <button
                    onClick={() => onRegenerate(visibleIdx, currentDepth - 1)}
                    disabled={currentDepth <= 1 || isStreaming}
                    className="h-5 w-5 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-25 disabled:cursor-not-allowed rounded"
                    title="Less depth"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[11px] font-medium text-gray-500 w-3.5 text-center leading-none">{currentDepth}</span>
                  <button
                    onClick={() => onRegenerate(visibleIdx, currentDepth + 1)}
                    disabled={currentDepth >= 5 || isStreaming}
                    className="h-5 w-5 flex items-center justify-center text-gray-500 hover:text-gray-800 disabled:opacity-25 disabled:cursor-not-allowed rounded"
                    title="More depth"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // User / quiz / flashcards / videos
        return (
          <div key={visibleIdx}>
            <MessageBubble message={message} />
          </div>
        );
      })}

      {/* Streaming new message — block-memoized markdown, no flicker */}
      {isStreaming && regeneratingIndex === null && (
        <div className="flex gap-2 justify-start">
          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0 mt-1">
            AI
          </div>
          {streamingContent ? (
            <div className="flex-1 min-w-0 rounded-2xl rounded-bl-md px-4 py-3 bg-white border border-gray-100 shadow-sm">
              <StreamingMarkdown content={streamingContent} isStreaming />
            </div>
          ) : (
            <StreamingIndicator />
          )}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
