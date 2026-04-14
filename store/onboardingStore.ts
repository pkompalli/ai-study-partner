'use client'
import { create } from 'zustand'
import api from '@/lib/api'
import { useCourseStore } from '@/store/courseStore'
import type { OnboardingSession, OnboardingMessage, CollectedData, CheckpointDef, OnboardingEvent } from '@/types/onboarding'

interface OnboardingState {
  sessionId: string | null
  session: OnboardingSession | null
  messages: OnboardingMessage[]
  isStreaming: boolean
  streamingContent: string
  currentLayer: number
  collectedData: CollectedData
  activeCheckpoint: CheckpointDef | null
  error: string | null

  startOnboarding: (fresh?: boolean) => Promise<void>
  resumeOnboarding: (id: string) => Promise<void>
  sendMessage: (content: string, checkpointData?: Record<string, unknown>) => Promise<void>
  startFresh: () => Promise<void>
  _resetting: boolean
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  sessionId: null,
  session: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  currentLayer: 1,
  collectedData: {},
  activeCheckpoint: null,
  error: null,
  _resetting: false,

  startOnboarding: async (fresh?: boolean) => {
    if (get().isStreaming || get().sessionId || get()._resetting) return
    try {
      const { data } = await api.post<{ id: string; resumed: boolean }>('/api/onboarding', { fresh: !!fresh })
      set({ sessionId: data.id, error: null })

      if (data.resumed) {
        // Load existing session
        await get().resumeOnboarding(data.id)
      } else {
        // Send initial greeting trigger
        set({ currentLayer: 1, messages: [], collectedData: {} })
        await get().sendMessage('Hi, I just signed up!')
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to start onboarding' })
    }
  },

  resumeOnboarding: async (id: string) => {
    try {
      const { data } = await api.get<{ session: OnboardingSession; messages: OnboardingMessage[] }>(`/api/onboarding/${id}`)
      set({
        sessionId: id,
        session: data.session,
        messages: data.messages,
        currentLayer: data.session.current_layer,
        collectedData: data.session.collected_data as CollectedData,
        error: null,
      })

      // Parse last assistant message for any pending checkpoint
      const lastAssistant = [...data.messages].reverse().find(m => m.role === 'assistant')
      if (lastAssistant) {
        const checkpoint = parseCheckpointFromContent(lastAssistant.content)
        if (checkpoint) {
          set({ activeCheckpoint: checkpoint })
        }
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load onboarding session' })
    }
  },

  sendMessage: async (content: string, checkpointData?: Record<string, unknown>) => {
    const { sessionId } = get()
    if (!sessionId) return

    // Add user message to local state
    const userMsg: OnboardingMessage = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content,
      content_type: 'text',
      metadata: null,
      created_at: new Date().toISOString(),
    }
    set(state => ({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingContent: '',
      activeCheckpoint: null,
      error: null,
    }))

    try {
      const response = await fetch(`/api/onboarding/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, checkpointData }),
      })

      if (!response.ok || !response.body) {
        set({ isStreaming: false, error: 'Failed to get response' })
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let latestCheckpoint: CheckpointDef | null = null
      let latestLayer = get().currentLayer
      let updatedData = { ...get().collectedData }
      let doneHandled = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6)) as OnboardingEvent

            if (event.type === 'course_created') {
              updatedData.courseId = event.courseId
              // Refresh sidebar immediately
              useCourseStore.getState().fetchCourses()
            } else if (event.type === 'chunk') {
              accumulated += event.content
              set({ streamingContent: stripStructuredBlocks(accumulated) })
            } else if (event.type === 'checkpoint') {
              latestCheckpoint = event.checkpoint
            } else if (event.type === 'layer_advance') {
              latestLayer = event.layer
            } else if (event.type === 'tool_result') {
              if (event.tool === 'generate_structure' && event.result) {
                updatedData.structure = event.result as CollectedData['structure']
              }
              if (event.tool === 'infer_exam_format' && event.result) {
                updatedData.inferredExamFormat = event.result as CollectedData['inferredExamFormat']
              }
              if (event.tool === 'finalize' && event.result) {
                const result = event.result as { courseId?: string; error?: string }
                if (result.courseId) {
                  updatedData.courseId = result.courseId
                }
              }
            } else if (event.type === 'done' && !doneHandled) {
              doneHandled = true
              const cleanContent = stripStructuredBlocks(accumulated)

              const assistantMsg: OnboardingMessage = {
                id: `temp-${Date.now()}-assistant`,
                session_id: sessionId,
                role: 'assistant',
                content: cleanContent,
                content_type: latestCheckpoint ? 'checkpoint' : 'text',
                metadata: latestCheckpoint ? { checkpoint: latestCheckpoint } : null,
                created_at: new Date().toISOString(),
              }
              const prevCourseId = get().collectedData.courseId
              set(state => ({
                messages: [...state.messages, assistantMsg],
                isStreaming: false,
                streamingContent: '',
                activeCheckpoint: latestCheckpoint,
                currentLayer: latestLayer,
                collectedData: { ...state.collectedData, ...updatedData },
              }))

              // Refresh sidebar courses when a new course was created
              if (updatedData.courseId && updatedData.courseId !== prevCourseId) {
                useCourseStore.getState().fetchCourses()
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }

      set({ isStreaming: false })
    } catch (err) {
      set({
        isStreaming: false,
        error: err instanceof Error ? err.message : 'Failed to send message',
      })
    }
  },

  startFresh: async () => {
    // Set resetting flag to prevent useEffect race
    set({
      _resetting: true,
      sessionId: null,
      session: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
      currentLayer: 1,
      collectedData: {},
      activeCheckpoint: null,
      error: null,
    })
    try {
      // Create brand new session (abandons old one on server)
      const { data } = await api.post<{ id: string; resumed: boolean }>('/api/onboarding', { fresh: true })
      set({ sessionId: data.id, _resetting: false, error: null })
      // Send initial greeting
      set({ currentLayer: 1, messages: [], collectedData: {} })
      await get().sendMessage('Hi, I just signed up!')
    } catch (err) {
      set({ _resetting: false, error: err instanceof Error ? err.message : 'Failed to restart' })
    }
  },
}))

function parseCheckpointFromContent(content: string): CheckpointDef | null {
  const match = content.match(/```checkpoint\s*\n([\s\S]*?)\n```/)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as CheckpointDef
  } catch {
    return null
  }
}

function stripStructuredBlocks(content: string): string {
  return content
    .replace(/```checkpoint\s*\n[\s\S]*?\n```/g, '')
    .replace(/```tool_call\s*\n[\s\S]*?\n```/g, '')
    .replace(/```layer_advance\s*\n[\s\S]*?\n```/g, '')
    .trim()
}
