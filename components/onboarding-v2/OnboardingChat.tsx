'use client'
import { useEffect, useRef, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnboardingStore } from '@/store/onboardingStore'
import { OnboardingMessage } from './OnboardingMessage'
import { CheckpointRenderer } from './CheckpointRenderer'
import { LayerProgress } from './LayerProgress'

export function OnboardingChat() {
  const {
    messages,
    isStreaming,
    streamingContent,
    currentLayer,
    activeCheckpoint,
    collectedData,
    error,
    sendMessage,
    startFresh,
  } = useOnboardingStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [textInput, setTextInput] = useState('')

  // Auto-scroll on new messages / streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, streamingContent])

  const handleSend = (text?: string) => {
    const content = (text ?? textInput).trim()
    if (!content || isStreaming) return
    // Intercept "start over" typed in chat
    if (content.toLowerCase().replace(/[^a-z ]/g, '').trim() === 'start over') {
      setTextInput('')
      startFresh()
      return
    }
    sendMessage(content)
    setTextInput('')
  }

  const handleCheckpointRespond = (displayText: string, data: Record<string, unknown>) => {
    if (isStreaming) return
    sendMessage(displayText, data)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Check if completed — redirect will be handled by the page
  const isComplete = currentLayer >= 8 && !!collectedData.courseId

  return (
    <div className="flex flex-col h-full">
      {/* Layer progress bar */}
      <div className="border-b border-gray-100 bg-white">
        <LayerProgress currentLayer={currentLayer} />
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages
          .filter(m => m.role !== 'system')
          .filter(m => !(m.role === 'user' && m.content === 'Hi, I just signed up!'))
          .map((msg, i) => (
            <OnboardingMessage
              key={msg.id ?? i}
              role={msg.role as 'user' | 'assistant'}
              content={msg.content}
            />
          ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <OnboardingMessage role="assistant" content={streamingContent} isStreaming />
        )}

        {/* Streaming indicator */}
        {isStreaming && !streamingContent && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Loader2 className="h-4 w-4 text-primary-600 animate-spin" />
            </div>
            <div className="bg-gray-50 rounded-2xl px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Active checkpoint UI */}
        {!isStreaming && activeCheckpoint && !isComplete && (
          <div className="ml-10">
            <CheckpointRenderer
              checkpoint={activeCheckpoint}
              onRespond={handleCheckpointRespond}
              disabled={isStreaming}
            />
          </div>
        )}

        {/* Completion state */}
        {isComplete && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
              <span className="text-sm font-medium text-green-700">You&apos;re all set!</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-2">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}
      </div>

      {/* Input area — hide when a checkpoint is active (it provides its own input) */}
      {!isComplete && !activeCheckpoint && (
        <div className="border-t border-gray-100 bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeCheckpoint ? 'Or type your answer...' : 'Type here...'}
              disabled={isStreaming}
              rows={1}
              className={cn(
                'flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                'min-h-[44px] max-h-[120px] disabled:bg-gray-50',
              )}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={isStreaming || !textInput.trim()}
              className={cn(
                'rounded-lg flex items-center justify-center transition-colors flex-shrink-0 p-2',
                textInput.trim() && !isStreaming
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
