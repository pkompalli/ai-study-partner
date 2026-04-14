'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCourseStore } from '@/store/courseStore'
import { useForYouStore, type ExamDate, type StudyPlanItem } from '@/store/forYouStore'
import type { Course, StudySession, TopicReadiness } from '@/types'
import {
  Zap, Calendar, Plus, X, ChevronRight, Pause,
  Clock, CheckCircle, XCircle, Trash2, Edit2, Check, BookOpen, Play,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
function urgencyColor(d: number) {
  if (d < 0) return 'text-gray-400'
  if (d <= 3) return 'text-red-500'
  if (d <= 7) return 'text-amber-500'
  if (d <= 14) return 'text-yellow-500'
  return 'text-primary-500'
}
function urgencyBg(d: number) {
  if (d < 0) return 'bg-gray-50 border-gray-200'
  if (d <= 3) return 'bg-red-50 border-red-200'
  if (d <= 7) return 'bg-amber-50 border-amber-200'
  if (d <= 14) return 'bg-yellow-50 border-yellow-200'
  return 'bg-primary-50 border-primary-200'
}

/** Selectable leaf in the topic/chapter tree */
interface SelectableItem { id: string; name: string }

interface TopicNode {
  topicId: string; topicName: string; subjectId: string; subjectName: string
  chapters: SelectableItem[]
  leafIds: string[] // chapter IDs, or [topicId] when no chapters
}

function getCourseHierarchy(course: Course | undefined): TopicNode[] {
  if (!course) return []
  const result: TopicNode[] = []
  for (const subj of (course.subjects ?? course.structure?.subjects ?? [])) {
    for (const topic of (subj.topics ?? [])) {
      const chapters = (topic.chapters ?? []).map(ch => ({ id: ch.id, name: ch.name }))
      result.push({
        topicId: topic.id, topicName: topic.name, subjectId: subj.id, subjectName: subj.name, chapters,
        leafIds: chapters.length > 0 ? chapters.map(c => c.id) : [topic.id],
      })
    }
  }
  return result
}
function getAllLeafIds(h: TopicNode[]): string[] { return h.flatMap(t => t.leafIds) }

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const dd = d.getDate().toString().padStart(2, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const yy = (d.getFullYear() % 100).toString().padStart(2, '0')
  return `${dd}/${mm}/${yy}`
}

function durationMinutes(start: string, end?: string) {
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  return Math.round((e - s) / 60000)
}

// ═══════════════════════════════════════════════════════════════════════
// Section 1 — Exam Dates
// ═══════════════════════════════════════════════════════════════════════

function ExamCountdownCard({ exam, courseName, topicNames, onEdit, onDelete }: {
  exam: ExamDate; courseName: string; topicNames: string[]
  onEdit: () => void; onDelete: () => void
}) {
  const days = daysUntil(exam.exam_date)
  const isPast = days < 0
  const isAll = !exam.chapter_ids || exam.chapter_ids.length === 0
  const resolved = topicNames.filter(n => !n.match(/^[0-9a-f]{8}-/))
  const coverageText = isAll ? 'All topics' : resolved.length > 0 ? resolved.join(', ') : 'All topics'

  return (
    <div className={cn('border rounded-xl p-4 transition-all', urgencyBg(days))}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className={cn('h-4 w-4 flex-shrink-0', urgencyColor(days))} />
            <span className="text-sm font-semibold text-gray-900 truncate">{exam.label}</span>
          </div>
          <p className="text-xs text-gray-500 truncate">{courseName}</p>
          <p className="text-xs text-gray-400 mt-1 truncate">{coverageText}</p>
          {exam.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{exam.notes}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          {isPast ? (
            <span className="text-xs text-gray-400">Past</span>
          ) : days === 0 ? (
            <span className="text-2xl font-bold text-red-600">Today</span>
          ) : (
            <div>
              <span className={cn('text-2xl font-bold', urgencyColor(days))}>{days}</span>
              <span className="text-xs text-gray-500 ml-1">{days === 1 ? 'day' : 'days'}</span>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(exam.exam_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-black/5">
        <button onClick={onEdit} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
          <Edit2 className="h-3 w-3" /> Edit
        </button>
        <span className="text-gray-200 mx-1">|</span>
        <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>
    </div>
  )
}

// ── Chapter multi-select (for add/edit exam date form) ───────────────

function ChapterMultiSelect({
  hierarchy, selected, allSelected, onToggle, onToggleBatch, onToggleAll, onExitAll,
}: {
  hierarchy: TopicNode[]; selected: Set<string>; allSelected: boolean
  onToggle: (id: string) => void; onToggleBatch: (ids: string[]) => void
  onToggleAll: () => void; onExitAll: (allIds: string[], keepIds: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const allIds = getAllLeafIds(hierarchy)
  const total = allIds.length
  const label = allSelected ? 'All topics'
    : selected.size === 0 ? 'Select topics'
    : selected.size === total ? 'All topics'
    : `${selected.size} of ${total} selected`

  const bySubject = new Map<string, TopicNode[]>()
  for (const t of hierarchy) { const l = bySubject.get(t.subjectName) ?? []; l.push(t); bySubject.set(t.subjectName, l) }

  const handleItem = (id: string) => { allSelected ? onExitAll(allIds, allIds.filter(x => x !== id)) : onToggle(id) }
  const handleTopic = (leafIds: string[]) => { allSelected ? onExitAll(allIds, allIds.filter(x => !leafIds.includes(x))) : onToggleBatch(leafIds) }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={cn('w-full border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary-400',
          allSelected || selected.size > 0 ? 'border-gray-200 text-gray-800' : 'border-gray-200 text-gray-400')}>
        <span className="truncate">{label}</span>
        <ChevronRight className={cn('h-3.5 w-3.5 text-gray-400 transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          <button type="button" onClick={onToggleAll}
            className={cn('w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-100', allSelected ? 'text-primary-700 font-medium' : 'text-gray-700')}>
            <div className={cn('h-4 w-4 rounded border flex items-center justify-center flex-shrink-0', allSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300')}>
              {allSelected && <Check className="h-3 w-3 text-white" />}
            </div>
            All topics
          </button>
          {Array.from(bySubject.entries()).map(([subjectName, topics]) => (
            <div key={subjectName}>
              {bySubject.size > 1 && <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">{subjectName}</p>}
              {topics.map(topic => {
                const hasChapters = topic.chapters.length > 0
                const eff = allSelected ? topic.leafIds.length : topic.leafIds.filter(id => selected.has(id)).length
                const allT = topic.leafIds.length > 0 && eff === topic.leafIds.length
                const someT = eff > 0 && !allT
                if (hasChapters) {
                  return (
                    <div key={topic.topicId}>
                      <button type="button" onClick={() => handleTopic(topic.leafIds)}
                        className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50', allT ? 'text-primary-700 font-medium' : 'text-gray-700')}>
                        <div className={cn('h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                          allT ? 'bg-primary-600 border-primary-600' : someT ? 'bg-primary-200 border-primary-400' : 'border-gray-300')}>
                          {allT && <Check className="h-3 w-3 text-white" />}
                          {someT && <div className="h-2 w-2 rounded-sm bg-primary-500" />}
                        </div>
                        <span className="truncate font-medium">{topic.topicName}</span>
                        <span className="text-xs text-gray-400 ml-auto">{eff}/{topic.leafIds.length}</span>
                      </button>
                      {topic.chapters.map(ch => {
                        const sel = allSelected || selected.has(ch.id)
                        return (
                          <button key={ch.id} type="button" onClick={() => handleItem(ch.id)}
                            className={cn('w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm hover:bg-gray-50', sel ? 'text-primary-600' : 'text-gray-500')}>
                            <div className={cn('h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0', sel ? 'bg-primary-600 border-primary-600' : 'border-gray-300')}>
                              {sel && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <span className="truncate">{ch.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                }
                const sel = allSelected || selected.has(topic.topicId)
                return (
                  <button key={topic.topicId} type="button" onClick={() => handleItem(topic.topicId)}
                    className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50', sel ? 'text-primary-700 font-medium' : 'text-gray-700')}>
                    <div className={cn('h-4 w-4 rounded border flex items-center justify-center flex-shrink-0', sel ? 'bg-primary-600 border-primary-600' : 'border-gray-300')}>
                      {sel && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="truncate">{topic.topicName}</span>
                  </button>
                )
              })}
            </div>
          ))}
          {total === 0 && <p className="px-3 py-3 text-xs text-gray-400">No topics found for this course.</p>}
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-2 flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-primary-600 font-medium hover:text-primary-700">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddExamDateForm({ courses, initialData, onSave, onCancel }: {
  courses: Course[]; initialData?: ExamDate
  onSave: (d: { id?: string; courseId: string; label: string; examDate: string; notes?: string; chapterIds?: string[] }) => Promise<void>
  onCancel: () => void
}) {
  const [courseId, setCourseId] = useState(initialData?.course_id ?? courses[0]?.id ?? '')
  const [label, setLabel] = useState(initialData?.label ?? '')
  const [examDate, setExamDate] = useState(initialData?.exam_date ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const initialIsAll = !initialData?.chapter_ids || initialData.chapter_ids.length === 0
  const [allChapters, setAllChapters] = useState(initialIsAll)
  const [sel, setSel] = useState<Set<string>>(new Set(initialIsAll ? [] : initialData?.chapter_ids ?? []))
  const hierarchy = getCourseHierarchy(courses.find(c => c.id === courseId))

  const handleCourseChange = (id: string) => { setCourseId(id); setAllChapters(true); setSel(new Set()) }
  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleBatch = (ids: string[]) => setSel(p => { const n = new Set(p); const allIn = ids.every(i => n.has(i)); ids.forEach(i => allIn ? n.delete(i) : n.add(i)); return n })
  const toggleAll = () => { setAllChapters(!allChapters); setSel(new Set()) }
  const exitAll = (_: string[], keep: string[]) => { setAllChapters(false); setSel(new Set(keep)) }
  const isValid = courseId && label && examDate && (allChapters || sel.size > 0)

  return (
    <form onSubmit={async e => { e.preventDefault(); if (!isValid) return; setSaving(true); try { await onSave({ id: initialData?.id, courseId, label, examDate, notes: notes || undefined, chapterIds: allChapters ? [] : Array.from(sel) }) } finally { setSaving(false) } }}
      className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{initialData ? 'Edit exam date' : 'Add exam date'}</h3>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Course</label>
          <select value={courseId} onChange={e => handleCourseChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Label</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Midterm, Final, Quiz 3" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date</label>
          <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Topics included</label>
          <ChapterMultiSelect hierarchy={hierarchy} selected={sel} allSelected={allChapters} onToggle={toggle} onToggleBatch={toggleBatch} onToggleAll={toggleAll} onExitAll={exitAll} />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Focus on thermodynamics, open book" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <button type="submit" disabled={saving || !isValid} className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : initialData ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Section 2 — Today's Sessions (day-view timeline)
// ═══════════════════════════════════════════════════════════════════════

const DURATION_OPTIONS = [15, 30, 60, 90] as const
type Duration = typeof DURATION_OPTIONS[number]

interface ScoredSuggestion {
  topicId: string; topicName: string; subjectId: string; courseId: string; courseName: string
  score: number; reason: string; duration: Duration
}

function computeSuggestions(
  courses: Course[],
  examDates: ExamDate[],
  readiness: Record<string, TopicReadiness[]>,
  studiedTopicIds: Set<string>,
): ScoredSuggestion[] {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const scored: ScoredSuggestion[] = []

  for (const course of courses) {
    const hierarchy = getCourseHierarchy(course)
    const courseExams = examDates.filter(e => e.course_id === course.id && daysUntil(e.exam_date) >= 0)
    const readinessMap = new Map((readiness[course.id] ?? []).map(r => [r.topic_id, r]))

    for (const topic of hierarchy) {
      if (studiedTopicIds.has(topic.topicId)) continue

      const r = readinessMap.get(topic.topicId)
      const readinessScore = r?.readiness_score ?? 0
      const attempted = r?.questions_attempted ?? 0

      // Find the nearest exam that covers this topic
      let nearestExamDays = 999
      for (const exam of courseExams) {
        const days = daysUntil(exam.exam_date)
        const isAll = !exam.chapter_ids || exam.chapter_ids.length === 0
        const covers = isAll || topic.leafIds.some(id => exam.chapter_ids.includes(id))
        if (covers && days < nearestExamDays) nearestExamDays = days
      }

      // Score: higher = more urgent to study
      // Proximity factor: closer exam = higher score (inverse of days)
      const proximityFactor = nearestExamDays < 999
        ? Math.max(1, 100 - nearestExamDays * 3)  // 100 for today, ~70 for 10 days, ~40 for 20 days
        : 10 // no exam scheduled — low priority

      // Weakness factor: lower readiness = higher score
      const weaknessFactor = attempted === 0 ? 60 : (100 - readinessScore)

      const totalScore = proximityFactor + weaknessFactor

      // Build reason text
      let reason = ''
      if (nearestExamDays < 999) {
        reason = nearestExamDays === 0 ? 'Exam today' :
          nearestExamDays === 1 ? 'Exam tomorrow' :
          `Exam in ${nearestExamDays}d`
      }
      if (attempted === 0) reason += reason ? ' · Not yet studied' : 'Not yet studied'
      else if (readinessScore < 50) reason += reason ? ` · ${readinessScore}% readiness` : `${readinessScore}% readiness`

      scored.push({
        topicId: topic.topicId, topicName: topic.topicName,
        subjectId: topic.subjectId, courseId: course.id, courseName: course.name,
        score: totalScore, reason: reason || 'Review', duration: 30,
      })
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 5)
}

function TodayTimeline({ sessions, courses, examDates, readiness, studyPlan, onSavePlan, onUpdateItem, onEndSession }: {
  sessions: StudySession[]; courses: Course[]
  examDates: ExamDate[]; readiness: Record<string, TopicReadiness[]>
  studyPlan: StudyPlanItem[]
  onSavePlan: (items: Array<{
    courseId: string; subjectId: string; topicId: string
    scheduledDate: string; scheduledTime: string; durationMinutes: number
  }>) => void
  onUpdateItem: (id: string, patch: { scheduledDate?: string; scheduledTime?: string; durationMinutes?: number; status?: string }) => void
  onEndSession: (sessionId: string) => Promise<void>
}) {
  const courseMap = new Map(courses.map(c => [c.id, c]))
  const savedRef = useRef(false)
  const [endingIds, setEndingIds] = useState<Set<string>>(new Set())

  // Build topic name lookup from all courses
  const topicNameMap = new Map<string, string>()
  const chapterNameMap = new Map<string, string>()
  for (const c of courses) {
    for (const s of (c.subjects ?? c.structure?.subjects ?? [])) {
      for (const t of (s.topics ?? [])) {
        topicNameMap.set(t.id, t.name)
        for (const ch of (t.chapters ?? [])) chapterNameMap.set(ch.id, ch.name)
      }
    }
  }

  // Filter to today's sessions, sorted by start time
  const todaySessions = sessions
    .filter(s => isToday(s.started_at))
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())

  const studiedTopicIds = new Set(todaySessions.map(s => s.topic_id).filter(Boolean))
  const suggestions = computeSuggestions(courses, examDates, readiness, studiedTopicIds as Set<string>)

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const startMinute = Math.ceil(now.getMinutes() / 30) * 30
  const defaultStart = new Date(now); defaultStart.setMinutes(startMinute, 0, 0)
  if (defaultStart <= now) defaultStart.setMinutes(defaultStart.getMinutes() + 30)

  // Build a map of persisted plan items by topicId
  const planByTopic = new Map(studyPlan.map(p => [p.topic_id, p]))

  // Merge suggestions with persisted plan: user overrides win
  let currentBlock = new Date(defaultStart)
  const merged = suggestions.map(s => {
    const saved = planByTopic.get(s.topicId)
    const planStatus = saved?.status ?? 'suggested'
    if (saved && saved.source === 'user') {
      // User override — use persisted values
      const start = new Date(`${saved.scheduled_date}T${saved.scheduled_time}`)
      return {
        ...s,
        planId: saved.id,
        planStatus,
        startTime: start,
        duration: saved.duration_minutes as Duration,
        dateStr: saved.scheduled_date,
        timeStr: saved.scheduled_time.slice(0, 5), // HH:MM
      }
    }
    // Auto or no saved item — compute sequential block
    const dur = saved?.duration_minutes ?? s.duration
    const timeStr = saved?.scheduled_time?.slice(0, 5) ?? `${currentBlock.getHours().toString().padStart(2, '0')}:${currentBlock.getMinutes().toString().padStart(2, '0')}`
    const dateStr = saved?.scheduled_date ?? todayStr
    const start = new Date(`${dateStr}T${timeStr}:00`)
    const end = new Date(start.getTime() + dur * 60000)
    if (!saved) currentBlock = end
    return {
      ...s,
      planId: saved?.id,
      planStatus,
      startTime: start,
      duration: dur as Duration,
      dateStr,
      timeStr,
    }
  }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  // Auto-save new suggestions that don't have a persisted plan item yet
  useEffect(() => {
    if (savedRef.current || suggestions.length === 0 || courses.length === 0) return
    const unsaved = merged.filter(s => !s.planId)
    if (unsaved.length === 0) return
    savedRef.current = true
    onSavePlan(unsaved.map(s => ({
      courseId: s.courseId, subjectId: s.subjectId, topicId: s.topicId,
      scheduledDate: s.dateStr, scheduledTime: s.timeStr, durationMinutes: s.duration,
    })))
  }, [suggestions.length, courses.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const todayLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const handleUpdate = (planId: string | undefined, patch: { scheduledDate?: string; scheduledTime?: string; durationMinutes?: number; status?: string }) => {
    if (planId) onUpdateItem(planId, patch)
  }

  // Find the "now" activity: an active session, or the current/next scheduled suggestion
  const activeSession = todaySessions.find(s => s.status === 'active')
  const nowMs = now.getTime()
  const pendingMerged = merged.filter(s => s.planStatus !== 'completed' && s.planStatus !== 'skipped')
  const currentSuggestion = !activeSession ? pendingMerged.find(s => {
    if (s.dateStr !== todayStr) return false
    const startMs = s.startTime.getTime()
    const endMs = startMs + s.duration * 60000
    return nowMs >= startMs && nowMs < endMs
  }) : null
  const nextSuggestion = !activeSession && !currentSuggestion ? pendingMerged.find(s => {
    return s.dateStr === todayStr && s.startTime.getTime() > nowMs
  }) : null
  // Read active session's timer for the Now banner
  let activeTimerPaused = false
  let activeTimerDisplay: string | null = null
  if (activeSession) {
    try {
      const td = localStorage.getItem('study_timer_' + activeSession.id)
      if (td) {
        const p = JSON.parse(td)
        activeTimerPaused = p.paused ?? false
        const e = p.elapsed ?? 0
        if (e > 0) activeTimerDisplay = e >= 3600
          ? `${Math.floor(e / 3600)}:${Math.floor((e % 3600) / 60).toString().padStart(2, '0')}:${(e % 60).toString().padStart(2, '0')}`
          : `${Math.floor(e / 60)}:${(e % 60).toString().padStart(2, '0')}`
      }
    } catch { /* ignore */ }
  }
  const nowItem = activeSession
    ? { label: topicNameMap.get(activeSession.topic_id ?? '') ?? activeSession.title ?? 'Study session', type: 'active' as const }
    : currentSuggestion
    ? { label: currentSuggestion.topicName, type: 'now' as const }
    : nextSuggestion
    ? { label: nextSuggestion.topicName, type: 'next' as const, time: nextSuggestion.timeStr }
    : null

  // 6-hour window: 3 hours back, 3 hours forward
  const windowStartMs = nowMs - 3 * 60 * 60 * 1000
  const windowEndMs = nowMs + 3 * 60 * 60 * 1000

  // Filter sessions to today + within window
  const pastSessions = todaySessions.filter(s => {
    if (s.status === 'active') return false
    const t = new Date(s.started_at).getTime()
    return t >= windowStartMs
  })

  // Filter suggestions to today only + within window
  const todayMerged = merged.filter(s => s.dateStr === todayStr)

  const pastSuggestions = todayMerged.filter(s => {
    const endMs = s.startTime.getTime() + s.duration * 60000
    return endMs < nowMs && s.startTime.getTime() >= windowStartMs
  })
  const upcomingSuggestions = todayMerged.filter(s => {
    const endMs = s.startTime.getTime() + s.duration * 60000
    return endMs >= nowMs && s.startTime.getTime() <= windowEndMs
  })

  const hasPast = pastSessions.length > 0 || pastSuggestions.length > 0
  const hasUpcoming = upcomingSuggestions.length > 0

  const renderSessionCard = (session: StudySession) => {
    const isActive = session.status === 'active'
    const course = courseMap.get(session.course_id)
    const tName = session.topic_id ? topicNameMap.get(session.topic_id) : null
    const chName = session.chapter_id ? chapterNameMap.get(session.chapter_id) : null
    const label = chName ?? tName ?? session.title ?? 'Study session'
    // Read timer data for elapsed time and paused state
    let dur = durationMinutes(session.started_at, session.ended_at)
    let timerElapsed = 0
    let timerPaused = false
    try {
      const timerData = localStorage.getItem('study_timer_' + session.id)
      if (timerData) {
        const parsed = JSON.parse(timerData)
        timerElapsed = parsed.elapsed ?? 0
        timerPaused = parsed.paused ?? false
        if (timerElapsed > 0) dur = Math.round(timerElapsed / 60)
      }
    } catch { /* ignore */ }
    const timerDisplay = timerElapsed > 0
      ? (timerElapsed >= 3600
        ? `${Math.floor(timerElapsed / 3600)}:${Math.floor((timerElapsed % 3600) / 60).toString().padStart(2, '0')}:${(timerElapsed % 60).toString().padStart(2, '0')}`
        : `${Math.floor(timerElapsed / 60)}:${(timerElapsed % 60).toString().padStart(2, '0')}`)
      : null

    return (
      <div key={session.id}
        className={cn(
          'flex items-stretch gap-3 rounded-xl border transition-all group',
          isActive && timerPaused ? 'border-amber-200 bg-amber-50/50' :
          isActive ? 'border-primary-200 bg-primary-50/50' : 'border-gray-100 hover:border-gray-200'
        )}>
        <div className={cn(
          'w-16 flex-shrink-0 flex flex-col items-center justify-center py-3 rounded-l-xl',
          isActive && timerPaused ? 'bg-amber-100/50' :
          isActive ? 'bg-primary-100/50' : 'bg-gray-50'
        )}>
          <span className="text-xs font-medium text-gray-700">{formatTime(session.started_at)}</span>
        </div>
        <Link href={`/sessions/${session.id}`} className="flex-1 py-3 pr-3 min-w-0">
          <div className="flex items-center gap-2">
            {isActive && timerPaused && <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />}
            {isActive && !timerPaused && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />}
            <p className={cn('text-sm font-medium truncate', isActive ? 'text-primary-700' : 'text-gray-800 group-hover:text-primary-700')}>
              {label}
            </p>
          </div>
          <p className="text-xs mt-0.5 truncate">
            <span className="text-gray-500">{course?.name ?? 'Course'}</span>
            {isActive && timerPaused && <span className="text-amber-600 ml-2 font-medium">Paused</span>}
          </p>
        </Link>
        <div className="flex items-center gap-2 pr-3 flex-shrink-0">
          {isActive ? (
            <div className="flex items-center gap-2">
              {timerDisplay && (
                <span className={cn('text-xs font-mono font-semibold', timerPaused ? 'text-amber-600' : 'text-primary-600')}>
                  {timerDisplay}
                </span>
              )}
              <button
                disabled={endingIds.has(session.id)}
                onClick={async () => {
                  setEndingIds(prev => new Set(prev).add(session.id))
                  await onEndSession(session.id)
                  setEndingIds(prev => { const n = new Set(prev); n.delete(session.id); return n })
                }}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {endingIds.has(session.id) ? 'Ending...' : 'End'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {timerDisplay && <span className="text-xs text-green-600 font-mono font-semibold">{timerDisplay}</span>}
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-gray-600 mb-3">{todayLabel}</p>

      {todaySessions.length === 0 && merged.length === 0 && (
        <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
          <BookOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No sessions today yet</p>
          <p className="text-xs text-gray-400 mt-1">Start a study session from any topic</p>
        </div>
      )}

      {/* ── Past: completed sessions + missed suggestion slots ── */}
      {hasPast && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Earlier today</p>
          <div className="space-y-1.5 opacity-60">
            {pastSessions.map(renderSessionCard)}
            {pastSuggestions.map(s => (
              <SuggestionRow key={s.topicId} item={s} todayStr={todayStr} onUpdate={handleUpdate} />
            ))}
          </div>
        </div>
      )}

      {/* ── Now banner ── */}
      {nowItem && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border',
          nowItem.type === 'active' && activeTimerPaused ? 'bg-amber-50 border-amber-200' :
          nowItem.type === 'active' ? 'bg-primary-50 border-primary-200' :
          nowItem.type === 'now' ? 'bg-amber-50 border-amber-200' :
          'bg-gray-50 border-gray-200'
        )}>
          <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
            nowItem.type === 'active' && activeTimerPaused ? 'bg-amber-100' :
            nowItem.type === 'active' ? 'bg-primary-100' :
            nowItem.type === 'now' ? 'bg-amber-100' : 'bg-gray-100'
          )}>
            {nowItem.type === 'active' && activeTimerPaused ? <Pause className="h-4 w-4 text-amber-600" /> :
             nowItem.type === 'active' ? <Play className="h-4 w-4 text-primary-600" /> :
             nowItem.type === 'now' ? <Zap className="h-4 w-4 text-amber-600" /> :
             <Clock className="h-4 w-4 text-gray-500" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              {nowItem.type === 'active' && activeTimerPaused ? 'Paused' :
               nowItem.type === 'active' ? 'In progress' :
               nowItem.type === 'now' ? 'Scheduled now' : `Up next · ${nowItem.time}`}
              {nowItem.type === 'active' && activeTimerDisplay && (
                <span className={cn('ml-2 font-mono', activeTimerPaused ? 'text-amber-700' : 'text-primary-600')}>{activeTimerDisplay}</span>
              )}
            </p>
            <p className={cn('text-sm font-semibold truncate',
              nowItem.type === 'active' && activeTimerPaused ? 'text-amber-700' :
              nowItem.type === 'active' ? 'text-primary-700' :
              nowItem.type === 'now' ? 'text-amber-700' : 'text-gray-700'
            )}>
              {nowItem.label}
            </p>
          </div>
          {nowItem.type !== 'active' && currentSuggestion && (
            <Link href={`/sessions/new?courseId=${currentSuggestion.courseId}&subjectId=${currentSuggestion.subjectId}&topicId=${currentSuggestion.topicId}`}
              className="text-xs font-semibold text-amber-600 hover:text-amber-800 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 transition-colors flex-shrink-0">
              Start
            </Link>
          )}
          {nowItem.type !== 'active' && nextSuggestion && !currentSuggestion && (
            <Link href={`/sessions/new?courseId=${nextSuggestion.courseId}&subjectId=${nextSuggestion.subjectId}&topicId=${nextSuggestion.topicId}`}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0">
              Start early
            </Link>
          )}
          {nowItem.type === 'active' && activeSession && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={`/sessions/${activeSession.id}`}
                className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-3 py-1.5 rounded-lg bg-primary-100 hover:bg-primary-200 transition-colors">
                Continue
              </Link>
              <button
                disabled={endingIds.has(activeSession.id)}
                onClick={async () => {
                  setEndingIds(prev => new Set(prev).add(activeSession.id))
                  await onEndSession(activeSession.id)
                  setEndingIds(prev => { const n = new Set(prev); n.delete(activeSession.id); return n })
                }}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {endingIds.has(activeSession.id) ? 'Ending...' : 'End'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Upcoming: future suggestion slots ── */}
      {hasUpcoming && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Upcoming</p>
          <div className="space-y-1.5">
            {upcomingSuggestions.map(s => (
              <SuggestionRow key={s.topicId} item={s} todayStr={todayStr} onUpdate={handleUpdate} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Single suggestion row — extracted so each row gets its own date input ref */
function SuggestionRow({ item: s, todayStr, onUpdate }: {
  item: { topicId: string; topicName: string; subjectId: string; courseId: string; courseName: string; reason: string; planId?: string; planStatus: string; duration: Duration; dateStr: string; timeStr: string }
  todayStr: string
  onUpdate: (planId: string | undefined, patch: { scheduledDate?: string; scheduledTime?: string; durationMinutes?: number; status?: string }) => void
}) {
  const dateRef = useRef<HTMLInputElement>(null)
  const isCompleted = s.planStatus === 'completed'
  const isSkipped = s.planStatus === 'skipped'
  const isDone = isCompleted || isSkipped

  if (isDone) {
    return (
      <div className={cn(
        'flex items-stretch gap-0 rounded-xl border transition-all',
        isCompleted ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50/30'
      )}>
        <div className="w-20 flex-shrink-0 flex flex-col justify-center py-2.5 pl-3 pr-1 border-r border-gray-100 rounded-l-xl gap-0.5">
          <span className={cn('text-xs font-semibold', isCompleted ? 'text-green-500' : 'text-gray-400')}>{s.timeStr}</span>
          <span className={cn('text-[11px] font-medium', isCompleted ? 'text-green-400' : 'text-gray-400')}>{formatShortDate(s.dateStr)}</span>
        </div>
        <div className="flex items-center gap-3 p-3 flex-1 min-w-0">
          {isCompleted ? (
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm truncate', isCompleted ? 'text-green-700' : 'text-gray-400 line-through')}>
              {s.topicName}
            </p>
            <p className={cn('text-xs mt-0.5', isCompleted ? 'text-green-500' : 'text-gray-400')}>
              {isCompleted ? 'Completed' : 'Skipped'} · {s.duration}m
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-stretch gap-0 rounded-xl border border-dashed border-gray-200 hover:border-primary-200 hover:bg-primary-50/30 transition-all group">
      {/* Left — time & date */}
      <div className="w-20 flex-shrink-0 flex flex-col justify-center py-2.5 pl-3 pr-1 border-r border-gray-100 bg-gray-50/50 rounded-l-xl gap-0.5">
        <input
          type="time"
          value={s.timeStr}
          onChange={e => { e.stopPropagation(); onUpdate(s.planId, { scheduledTime: e.target.value }) }}
          onClick={e => e.stopPropagation()}
          className="text-xs font-semibold text-primary-600 hover:text-primary-800 bg-transparent border-none focus:outline-none cursor-pointer text-left w-full [&::-webkit-calendar-picker-indicator]:hidden"
        />
        <button
          type="button"
          onClick={e => { e.stopPropagation(); dateRef.current?.showPicker() }}
          className="text-[11px] font-medium text-primary-500 hover:text-primary-700 cursor-pointer text-left"
        >
          {formatShortDate(s.dateStr)}
        </button>
        <input
          ref={dateRef}
          type="date"
          value={s.dateStr}
          onChange={e => { e.stopPropagation(); onUpdate(s.planId, { scheduledDate: e.target.value }) }}
          min={todayStr}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
      {/* Middle — topic info */}
      <Link href={`/sessions/new?courseId=${s.courseId}&subjectId=${s.subjectId}&topicId=${s.topicId}`}
        className="flex items-center gap-3 p-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-600 group-hover:text-primary-700 truncate">{s.topicName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-500 truncate">{s.courseName}</p>
            {s.reason && <span className="text-[10px] text-amber-600 font-medium whitespace-nowrap">{s.reason}</span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-400 flex-shrink-0" />
      </Link>
      {/* Right — duration + skip */}
      <div className="flex items-center border-l border-gray-100 px-2 gap-1">
        <select
          value={s.duration}
          onChange={e => { e.stopPropagation(); onUpdate(s.planId, { durationMinutes: Number(e.target.value) }) }}
          onClick={e => e.stopPropagation()}
          className="text-[11px] font-semibold text-primary-500 hover:text-primary-700 bg-transparent border-none focus:outline-none cursor-pointer text-center"
        >
          {DURATION_OPTIONS.map(d => (
            <option key={d} value={d}>{d}m</option>
          ))}
        </select>
        {s.planId && (
          <button
            onClick={e => { e.stopPropagation(); onUpdate(s.planId, { status: 'skipped' }) }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-100 transition-opacity"
            title="Skip this session"
          >
            <XCircle className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Section 3 — Readiness
// ═══════════════════════════════════════════════════════════════════════

function readinessColor(s: number) {
  if (s >= 80) return 'bg-green-500'
  if (s >= 50) return 'bg-yellow-500'
  if (s >= 20) return 'bg-amber-500'
  return 'bg-gray-300'
}
function readinessLabel(s: number, attempted: number) {
  if (attempted === 0) return 'Not yet'
  if (s >= 80) return 'Strong'
  if (s >= 50) return 'Moderate'
  if (s >= 20) return 'Weak'
  return 'Getting started'
}

function ReadinessBar({ topic, courseId, subjectId }: { topic: TopicReadiness; courseId: string; subjectId?: string }) {
  const notYet = topic.questions_attempted === 0
  const sessionUrl = subjectId
    ? `/sessions/new?courseId=${courseId}&subjectId=${subjectId}&topicId=${topic.topic_id}`
    : `/sessions/new?courseId=${courseId}&topicId=${topic.topic_id}`
  return (
    <Link href={sessionUrl}
      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate group-hover:text-primary-700">{topic.topic_name}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            {notYet ? (
              <div className="h-full w-full bg-gray-100" />
            ) : (
              <div className={cn('h-full rounded-full', readinessColor(topic.readiness_score))}
                style={{ width: `${Math.max(topic.readiness_score, 2)}%` }} />
            )}
          </div>
          <span className={cn('text-xs w-16 text-right', notYet ? 'text-gray-300 italic' : 'text-gray-400')}>
            {readinessLabel(topic.readiness_score, topic.questions_attempted)}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-400 flex-shrink-0" />
    </Link>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════

export default function ForYouPage() {
  const { courses, fetchCourses } = useCourseStore()
  const {
    examDates, examDatesLoading, fetchExamDates, addExamDate, updateExamDate, removeExamDate,
    sessions, fetchSessions,
    readiness, fetchReadiness,
    studyPlan, fetchStudyPlan, saveStudyPlanBatch, updateStudyPlanItem,
  } = useForYouStore()

  const [showForm, setShowForm] = useState(false)
  const [editingDate, setEditingDate] = useState<ExamDate | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)
  useEffect(() => { fetchCourses({ force: true }); fetchExamDates(); fetchSessions(); fetchStudyPlan(todayStr) }, [])
  useEffect(() => { for (const c of courses) { if (!readiness[c.id]) fetchReadiness(c.id) } }, [courses])

  const courseMap = new Map(courses.map(c => [c.id, c]))

  // Leaf name map for exam date cards
  const leafNameMap = new Map<string, string>()
  for (const c of courses) {
    for (const t of getCourseHierarchy(c)) {
      if (t.chapters.length > 0) t.chapters.forEach(ch => leafNameMap.set(ch.id, ch.name))
      else leafNameMap.set(t.topicId, t.topicName)
    }
  }

  const upcomingExams = examDates.filter(e => daysUntil(e.exam_date) >= 0)
  const pastExams = examDates.filter(e => daysUntil(e.exam_date) < 0)

  const handleEndSession = useCallback(async (sessionId: string) => {
    try {
      await api.patch(`/api/sessions/${sessionId}/end`)
      fetchSessions() // refresh the list
    } catch (err) {
      console.error('[ForYou] endSession error:', err)
    }
  }, [fetchSessions])

  const handleSave = async (data: { id?: string; courseId: string; label: string; examDate: string; notes?: string; chapterIds?: string[] }) => {
    if (data.id) await updateExamDate({ id: data.id, courseId: data.courseId, label: data.label, examDate: data.examDate, notes: data.notes, chapterIds: data.chapterIds })
    else await addExamDate({ courseId: data.courseId, label: data.label, examDate: data.examDate, notes: data.notes, chapterIds: data.chapterIds })
    setShowForm(false); setEditingDate(null)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">For you now</h1>
          <p className="text-sm text-gray-500">What matters most, right now</p>
        </div>
      </div>

      {/* ── Section 1: Exam Dates ── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary-500" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Exam dates</h2>
          </div>
          <button onClick={() => { setEditingDate(null); setShowForm(true) }}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
            <Plus className="h-3.5 w-3.5" /> Add date
          </button>
        </div>

        {(showForm || editingDate) && (
          <div className="mb-4">
            <AddExamDateForm courses={courses} initialData={editingDate ?? undefined} onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingDate(null) }} />
          </div>
        )}

        {examDatesLoading && examDates.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Loading...</p>
        ) : upcomingExams.length === 0 && !showForm ? (
          <div className="text-center py-6 border border-dashed border-gray-200 rounded-xl">
            <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 mb-2">No upcoming exams tracked</p>
            <button onClick={() => setShowForm(true)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Add your first exam date
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingExams.map(exam => (
              <ExamCountdownCard key={exam.id} exam={exam}
                courseName={courseMap.get(exam.course_id)?.name ?? 'Unknown course'}
                topicNames={(exam.chapter_ids ?? []).map(id => leafNameMap.get(id) ?? id)}
                onEdit={() => { setEditingDate(exam); setShowForm(false) }}
                onDelete={() => removeExamDate(exam.id)} />
            ))}
          </div>
        )}

        {pastExams.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-500">
              {pastExams.length} past {pastExams.length === 1 ? 'exam' : 'exams'}
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {pastExams.map(exam => (
                <ExamCountdownCard key={exam.id} exam={exam}
                  courseName={courseMap.get(exam.course_id)?.name ?? 'Unknown course'}
                  topicNames={(exam.chapter_ids ?? []).map(id => leafNameMap.get(id) ?? id)}
                  onEdit={() => { setEditingDate(exam); setShowForm(false) }}
                  onDelete={() => removeExamDate(exam.id)} />
              ))}
            </div>
          </details>
        )}
      </section>

      {/* ── Section 2: Today's Sessions ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-primary-500" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Today</h2>
        </div>
        <TodayTimeline
          sessions={sessions} courses={courses} examDates={examDates} readiness={readiness}
          studyPlan={studyPlan} onSavePlan={saveStudyPlanBatch} onUpdateItem={updateStudyPlanItem}
          onEndSession={handleEndSession}
        />
      </section>

      {/* ── Section 3: Readiness ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="h-4 w-4 text-primary-500" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Readiness so far</h2>
        </div>

        {courses.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Add a course to see readiness data.</p>
        ) : (
          <div className="space-y-4">
            {courses.map(course => {
              const readinessTopics = readiness[course.id] ?? []
              const readinessMap = new Map(readinessTopics.map(t => [t.topic_id, t]))
              const hierarchy = getCourseHierarchy(course)
              const topicSubjectMap = new Map(hierarchy.map(t => [t.topicId, t.subjectId]))
              const allTopics: TopicReadiness[] = hierarchy.map(t => {
                const r = readinessMap.get(t.topicId)
                return {
                  topic_id: t.topicId, topic_name: t.topicName,
                  questions_attempted: r?.questions_attempted ?? 0,
                  questions_correct: r?.questions_correct ?? 0,
                  readiness_score: r?.readiness_score ?? 0,
                }
              })
              const attempted = allTopics.filter(t => t.questions_attempted > 0)
              const avgReadiness = attempted.length > 0
                ? Math.round(attempted.reduce((s, t) => s + t.readiness_score, 0) / attempted.length)
                : 0

              return (
                <div key={course.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Link href={`/courses/${course.id}`} className="text-sm font-semibold text-gray-800 hover:text-primary-700 transition-colors">
                      {course.name}
                    </Link>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full',
                      attempted.length === 0 ? 'bg-gray-100 text-gray-400' :
                      avgReadiness >= 80 ? 'bg-green-100 text-green-600' :
                      avgReadiness >= 50 ? 'bg-yellow-100 text-yellow-600' :
                      avgReadiness >= 20 ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-500')}>
                      {attempted.length === 0 ? 'Not yet tested' : `${avgReadiness}% overall`}
                    </span>
                  </div>
                  {allTopics.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No topics found.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {allTopics.map(t => <ReadinessBar key={t.topic_id} topic={t} courseId={course.id} subjectId={topicSubjectMap.get(t.topic_id)} />)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
