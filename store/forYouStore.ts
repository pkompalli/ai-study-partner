'use client'
import { create } from 'zustand'
import api from '@/lib/api'
import type { StudySession, TopicReadiness } from '@/types'

export interface ExamDate {
  id: string
  course_id: string
  label: string
  exam_date: string
  notes: string | null
  chapter_ids: string[]   // empty = ALL chapters
  created_at: string
}

export interface StudyPlanItem {
  id: string
  user_id: string
  course_id: string
  subject_id: string
  topic_id: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  status: 'suggested' | 'scheduled' | 'completed' | 'skipped'
  source: 'auto' | 'user'
  created_at: string
  updated_at: string
}

interface ForYouState {
  examDates: ExamDate[]
  examDatesLoading: boolean

  sessions: StudySession[]
  sessionsLoading: boolean

  readiness: Record<string, TopicReadiness[]>
  readinessLoading: boolean

  studyPlan: StudyPlanItem[]
  studyPlanLoading: boolean

  fetchExamDates: () => Promise<void>
  addExamDate: (params: { courseId: string; label: string; examDate: string; notes?: string; chapterIds?: string[] }) => Promise<void>
  updateExamDate: (params: { id: string; courseId: string; label: string; examDate: string; notes?: string; chapterIds?: string[] }) => Promise<void>
  removeExamDate: (id: string) => Promise<void>
  fetchSessions: () => Promise<void>
  fetchReadiness: (courseId: string) => Promise<void>

  fetchStudyPlan: (date?: string) => Promise<void>
  saveStudyPlanBatch: (items: Array<{
    courseId: string; subjectId: string; topicId: string
    scheduledDate: string; scheduledTime: string; durationMinutes: number
    source?: 'auto' | 'user'
  }>) => Promise<void>
  updateStudyPlanItem: (id: string, patch: {
    scheduledDate?: string; scheduledTime?: string; durationMinutes?: number
  }) => Promise<void>
  removeStudyPlanItem: (id: string) => Promise<void>
}

export const useForYouStore = create<ForYouState>((set, get) => ({
  examDates: [],
  examDatesLoading: false,
  sessions: [],
  sessionsLoading: false,
  readiness: {},
  readinessLoading: false,
  studyPlan: [],
  studyPlanLoading: false,

  fetchExamDates: async () => {
    if (get().examDatesLoading) return
    set({ examDatesLoading: true })
    try {
      const { data } = await api.get<{ dates: ExamDate[] }>('/api/exam-dates')
      set({ examDates: data.dates })
    } catch (err) {
      console.error('[forYouStore] fetchExamDates error:', err)
    } finally {
      set({ examDatesLoading: false })
    }
  },

  addExamDate: async (params) => {
    const { data } = await api.post<{ date: ExamDate }>('/api/exam-dates', params)
    set(s => ({ examDates: [...s.examDates, data.date].sort((a, b) => a.exam_date.localeCompare(b.exam_date)) }))
  },

  updateExamDate: async (params) => {
    const { data } = await api.post<{ date: ExamDate }>('/api/exam-dates', params)
    set(s => ({
      examDates: s.examDates.map(d => d.id === params.id ? data.date : d)
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
    }))
  },

  removeExamDate: async (id) => {
    await api.delete(`/api/exam-dates/${id}`)
    set(s => ({ examDates: s.examDates.filter(d => d.id !== id) }))
  },

  fetchSessions: async () => {
    if (get().sessionsLoading) return
    set({ sessionsLoading: true })
    try {
      const { data } = await api.get<StudySession[]>('/api/sessions')
      set({ sessions: data })
    } catch (err) {
      console.error('[forYouStore] fetchSessions error:', err)
    } finally {
      set({ sessionsLoading: false })
    }
  },

  fetchReadiness: async (courseId) => {
    set({ readinessLoading: true })
    try {
      const { data } = await api.get<TopicReadiness[]>(`/api/exam/readiness?courseId=${courseId}`)
      set(s => ({ readiness: { ...s.readiness, [courseId]: data } }))
    } catch (err) {
      console.error('[forYouStore] fetchReadiness error:', err)
    } finally {
      set({ readinessLoading: false })
    }
  },

  fetchStudyPlan: async (date) => {
    if (get().studyPlanLoading) return
    set({ studyPlanLoading: true })
    try {
      const url = date ? `/api/study-plan?date=${date}` : '/api/study-plan'
      const { data } = await api.get<{ items: StudyPlanItem[] }>(url)
      set({ studyPlan: data.items })
    } catch (err) {
      console.error('[forYouStore] fetchStudyPlan error:', err)
    } finally {
      set({ studyPlanLoading: false })
    }
  },

  saveStudyPlanBatch: async (items) => {
    try {
      const { data } = await api.post<{ items: StudyPlanItem[] }>('/api/study-plan', { items })
      // Merge new items into existing plan, replacing by topic_id+scheduled_date
      set(s => {
        const existing = new Map(s.studyPlan.map(i => [`${i.topic_id}_${i.scheduled_date}`, i]))
        for (const item of data.items) {
          existing.set(`${item.topic_id}_${item.scheduled_date}`, item)
        }
        return { studyPlan: Array.from(existing.values()) }
      })
    } catch (err) {
      console.error('[forYouStore] saveStudyPlanBatch error:', err)
    }
  },

  updateStudyPlanItem: async (id, patch) => {
    // Optimistic update
    set(s => ({
      studyPlan: s.studyPlan.map(i => i.id === id ? {
        ...i,
        ...(patch.scheduledDate !== undefined ? { scheduled_date: patch.scheduledDate } : {}),
        ...(patch.scheduledTime !== undefined ? { scheduled_time: patch.scheduledTime } : {}),
        ...(patch.durationMinutes !== undefined ? { duration_minutes: patch.durationMinutes } : {}),
        source: 'user' as const,
      } : i)
    }))
    try {
      const { data } = await api.patch<{ item: StudyPlanItem }>(`/api/study-plan/${id}`, patch)
      set(s => ({ studyPlan: s.studyPlan.map(i => i.id === id ? data.item : i) }))
    } catch (err) {
      console.error('[forYouStore] updateStudyPlanItem error:', err)
    }
  },

  removeStudyPlanItem: async (id) => {
    set(s => ({ studyPlan: s.studyPlan.filter(i => i.id !== id) }))
    try {
      await api.delete(`/api/study-plan/${id}`)
    } catch (err) {
      console.error('[forYouStore] removeStudyPlanItem error:', err)
    }
  },
}))
