'use client'
import { cn } from '@/lib/utils'
import { StreamingMarkdown } from '@/components/ui/StreamingMarkdown'
import { Bot, User } from 'lucide-react'

interface OnboardingMessageProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming?: boolean
}

/** Strip ```checkpoint, ```tool_call, ```layer_advance blocks from content */
function cleanContent(content: string): string {
  return content
    .replace(/```checkpoint\s*\n[\s\S]*?\n```/g, '')
    .replace(/```tool_call\s*\n[\s\S]*?\n```/g, '')
    .replace(/```layer_advance\s*\n[\s\S]*?\n```/g, '')
    .trim()
}

/** Parse user message — may be raw JSON from checkpoint responses */
function parseUserContent(content: string): string {
  try {
    const parsed = JSON.parse(content)
    if (typeof parsed === 'object' && parsed.text) {
      return parsed.text
    }
  } catch { /* not JSON, use as-is */ }
  return content
}

export function OnboardingMessage({ role, content, isStreaming }: OnboardingMessageProps) {
  if (role === 'system') return null

  const displayContent = role === 'assistant'
    ? cleanContent(content)
    : parseUserContent(content)

  if (!displayContent) return null

  return (
    <div className={cn('flex gap-3', role === 'user' ? 'justify-end' : 'justify-start')}>
      {role === 'assistant' && (
        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-primary-600" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5',
          role === 'user'
            ? 'bg-primary-600 text-white'
            : 'bg-gray-50 text-gray-900',
        )}
      >
        {role === 'assistant' ? (
          <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-li:my-0.5">
            <StreamingMarkdown content={displayContent} isStreaming={isStreaming} />
          </div>
        ) : (
          <p className="text-sm">{displayContent}</p>
        )}
      </div>
      {role === 'user' && (
        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="h-4 w-4 text-gray-500" />
        </div>
      )}
    </div>
  )
}
