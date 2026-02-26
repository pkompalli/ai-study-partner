'use client'
import { create } from 'zustand';
import api from '@/lib/api';
import type {
  ExamFormat, ExamSection, ExamQuestion, ExamAttempt, LocalAnswerState, TopicReadiness, MarkCriterion,
} from '@/types';

const EXAM_CACHE_SCHEMA_VERSION = 2;
const EXAM_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface PaperPreview {
  name: string;
  total_marks?: number;
  time_minutes?: number;
  instructions?: string;
  sections: Array<{
    name: string;
    question_type: ExamSection['question_type'];
    num_questions: number;
    marks_per_question?: number;
    instructions?: string;
  }>;
  questions: Array<{
    section_index: number;
    question_text: string;
    dataset?: string;
    options?: string[];
    correct_option_index?: number;
    max_marks: number;
    mark_scheme: MarkCriterion[];
  }>;
  questions_truncated: boolean;
}

interface ExamState {
  // Format management
  formats: ExamFormat[];
  formatsLoading: boolean;

  // Active format & questions
  activeFormat: ExamFormat | null;
  questions: ExamQuestion[];
  questionsLoading: boolean;
  generatingQuestions: boolean;

  // Practice session
  activeAttempt: ExamAttempt | null;
  currentQuestionIndex: number;
  answers: Record<string, LocalAnswerState>;  // keyed by questionId
  markingQuestionId: string | null;
  hintLoading: boolean;
  currentHint: string | null;
  practiceComplete: boolean;

  // Readiness
  readiness: TopicReadiness[];

  // Inferred format (preview before saving)
  inferredFormat: {
    name?: string;
    description?: string;
    total_marks?: number;
    time_minutes?: number;
    sections?: Array<{
      name: string;
      question_type: ExamSection['question_type'];
      num_questions: number;
      marks_per_question?: number;
    }>;
  } | null;
  inferring: boolean;

  // Paper extraction
  extractedPaper: PaperPreview | null;
  paperExtracting: boolean;

  // Session exam tab (in-session, no attempt tracking)
  sessionBankAll: ExamQuestion[];
  sessionBatch: ExamQuestion[];
  sessionHints: Record<string, { text: string; count: number }>;
  sessionHintLoading: string | null; // questionId currently loading
  sessionBankOffset: number;
  sessionAnswers: Record<string, { answerText: string; selectedOptionIndex?: number; score?: number; feedback?: string; marked: boolean }>;
  sessionMarkingId: string | null;
  sessionBatchLoading: boolean;
  sessionBatchGenerating: boolean;
  sessionBatchError: string | null;
  examDifficulty: number;
  requestedCount: number;
  sessionFullAnswers: Record<string, string>; // questionId → full worked answer
  sessionFullAnswerLoading: string | null;    // questionId currently loading

  // Actions
  fetchFormats: (courseId: string) => Promise<void>;
  inferFormat: (courseId: string, examName: string) => Promise<void>;
  createFormat: (courseId: string, payload: {
    name: string;
    description?: string;
    total_marks?: number;
    time_minutes?: number;
    instructions?: string;
    sections: Array<{
      name: string;
      question_type: ExamSection['question_type'];
      num_questions: number;
      marks_per_question?: number;
      total_marks?: number;
      instructions?: string;
    }>;
  }) => Promise<ExamFormat>;
  updateFormat: (formatId: string, payload: {
    name?: string;
    description?: string;
    total_marks?: number;
    time_minutes?: number;
    instructions?: string;
    sections?: Array<{
      name: string;
      question_type: ExamSection['question_type'];
      num_questions: number;
      marks_per_question?: number;
      total_marks?: number;
      instructions?: string;
    }>;
  }) => Promise<ExamFormat>;
  deleteFormat: (formatId: string) => Promise<void>;
  setActiveFormat: (format: ExamFormat | null) => void;
  clearInferredFormat: () => void;

  generateQuestions: (formatId: string) => Promise<void>;
  fetchQuestions: (formatId: string) => Promise<void>;

  startPractice: (formatId: string) => Promise<void>;
  setAnswerText: (questionId: string, text: string) => void;
  setSelectedOption: (questionId: string, index: number) => void;
  submitAnswer: (questionId: string) => Promise<void>;
  fetchHint: (questionId: string) => Promise<void>;
  clearHint: () => void;
  nextQuestion: () => void;
  exitPractice: () => void;

  fetchReadiness: (courseId: string) => Promise<void>;

  extractPaper: (files: File[]) => Promise<void>;
  clearExtractedPaper: () => void;
  importPaper: (courseId: string) => Promise<ExamFormat>;

  // Session exam tab actions
  loadSessionBatch: (formatId: string, topicId?: string, chapterId?: string) => Promise<void>;
  loadMoreSessionBatch: (formatId: string, topicId?: string, chapterId?: string) => Promise<void>;
  refreshBatchAtDifficulty: (formatId: string, difficulty: number, topicId?: string, chapterId?: string) => Promise<void>;
  setSessionAnswerText: (questionId: string, text: string) => void;
  setSessionSelectedOption: (questionId: string, index: number) => void;
  submitSessionAnswer: (questionId: string, files?: File[]) => Promise<void>;
  fetchSessionHint: (questionId: string, answerText?: string) => Promise<void>;
  clearSessionHint: (questionId: string) => void;
  fetchSessionFullAnswer: (questionId: string) => Promise<void>;
  setExamDifficulty: (d: number) => void;
  setRequestedCount: (n: number) => void;
  persistExamState: (sessionId: string) => void;
  restoreExamState: (sessionId: string) => boolean;
  clearSessionExam: () => void;
}

export const useExamStore = create<ExamState>((set, get) => ({
  formats: [],
  formatsLoading: false,
  activeFormat: null,
  questions: [],
  questionsLoading: false,
  generatingQuestions: false,
  activeAttempt: null,
  currentQuestionIndex: 0,
  answers: {},
  markingQuestionId: null,
  hintLoading: false,
  currentHint: null,
  practiceComplete: false,
  readiness: [],
  inferredFormat: null,
  inferring: false,
  extractedPaper: null,
  paperExtracting: false,
  sessionBankAll: [],
  sessionBatch: [],
  sessionBankOffset: 0,
  sessionAnswers: {},
  sessionHints: {},
  sessionHintLoading: null,
  sessionMarkingId: null,
  sessionBatchLoading: false,
  sessionBatchGenerating: false,
  sessionBatchError: null,
  examDifficulty: 3,
  requestedCount: 5,
  sessionFullAnswers: {},
  sessionFullAnswerLoading: null,

  fetchFormats: async (courseId) => {
    set({ formatsLoading: true });
    try {
      const { data } = await api.get<ExamFormat[]>(`/api/exam/formats?courseId=${courseId}`);
      set({ formats: data ?? [] });
    } finally {
      set({ formatsLoading: false });
    }
  },

  inferFormat: async (courseId, examName) => {
    set({ inferring: true, inferredFormat: null });
    try {
      const { data } = await api.post<{
        name?: string; description?: string; total_marks?: number; time_minutes?: number;
        sections?: Array<{ name: string; question_type: ExamSection['question_type']; num_questions: number; marks_per_question?: number }>;
      }>('/api/exam/formats/infer', { courseId, examName });
      set({ inferredFormat: data });
    } finally {
      set({ inferring: false });
    }
  },

  createFormat: async (courseId, payload) => {
    const { data } = await api.post<ExamFormat>('/api/exam/formats', { courseId, ...payload });
    set(state => ({ formats: [data, ...state.formats], inferredFormat: null }));
    return data;
  },

  updateFormat: async (formatId, payload) => {
    const { data } = await api.put<ExamFormat>(`/api/exam/formats/${formatId}`, payload);
    set(state => ({
      formats: state.formats.map(f => f.id === formatId ? data : f),
      activeFormat: state.activeFormat?.id === formatId ? data : state.activeFormat,
    }));
    return data;
  },

  deleteFormat: async (formatId) => {
    await api.delete(`/api/exam/formats/${formatId}`);
    set(state => ({
      formats: state.formats.filter(f => f.id !== formatId),
      activeFormat: state.activeFormat?.id === formatId ? null : state.activeFormat,
    }));
  },

  setActiveFormat: (format) => set({ activeFormat: format }),
  clearInferredFormat: () => set({ inferredFormat: null }),

  generateQuestions: async (formatId) => {
    set({ generatingQuestions: true });
    try {
      const { data } = await api.post<{ questions: ExamQuestion[] }>(`/api/exam/formats/${formatId}/questions`);
      set({ questions: data.questions ?? [] });
      // Refresh format to update question_count
      const { data: fmt } = await api.get<ExamFormat>(`/api/exam/formats/${formatId}`);
      set(state => ({
        activeFormat: fmt,
        formats: state.formats.map(f => f.id === formatId ? fmt : f),
      }));
    } finally {
      set({ generatingQuestions: false });
    }
  },

  fetchQuestions: async (formatId) => {
    set({ questionsLoading: true });
    try {
      const { data } = await api.get<ExamQuestion[]>(`/api/exam/formats/${formatId}/questions`);
      set({ questions: data ?? [] });
    } finally {
      set({ questionsLoading: false });
    }
  },

  startPractice: async (formatId) => {
    // Load questions if not already loaded
    let { questions } = get();
    if (questions.length === 0 || questions[0]?.exam_format_id !== formatId) {
      set({ questionsLoading: true });
      const { data } = await api.post<{ attemptId: string; questions: ExamQuestion[] }>(
        '/api/exam/attempts', { formatId, mode: 'practice' }
      );
      set({
        activeAttempt: { id: data.attemptId, exam_format_id: formatId, mode: 'practice', started_at: new Date().toISOString(), answers: [] },
        questions: data.questions,
        questionsLoading: false,
        currentQuestionIndex: 0,
        answers: {},
        practiceComplete: false,
        currentHint: null,
      });
    } else {
      const { data } = await api.post<{ attemptId: string; questions: ExamQuestion[] }>(
        '/api/exam/attempts', { formatId, mode: 'practice' }
      );
      set({
        activeAttempt: { id: data.attemptId, exam_format_id: formatId, mode: 'practice', started_at: new Date().toISOString(), answers: [] },
        questions: data.questions,
        currentQuestionIndex: 0,
        answers: {},
        practiceComplete: false,
        currentHint: null,
      });
    }
  },

  setAnswerText: (questionId, text) => {
    set(state => ({
      answers: {
        ...state.answers,
        [questionId]: {
          ...(state.answers[questionId] ?? { hintsUsed: 0, marked: false, answerText: '' }),
          answerText: text,
        },
      },
    }));
  },

  setSelectedOption: (questionId, index) => {
    set(state => ({
      answers: {
        ...state.answers,
        [questionId]: {
          ...(state.answers[questionId] ?? { hintsUsed: 0, marked: false, answerText: '' }),
          selectedOptionIndex: index,
          answerText: '',
        },
      },
    }));
  },

  submitAnswer: async (questionId) => {
    const { activeAttempt, questions, answers } = get();
    if (!activeAttempt) return;

    const question = questions.find(q => q.id === questionId);
    if (!question) return;

    const localAnswer = answers[questionId] ?? { hintsUsed: 0, marked: false, answerText: '', selectedOptionIndex: undefined };

    set({ markingQuestionId: questionId });

    try {
      const { data } = await api.post<{ score?: number; maxMarks?: number; feedback?: string; saved?: boolean }>(
        `/api/exam/attempts/${activeAttempt.id}/answer`,
        {
          questionId,
          answerText: localAnswer.answerText || undefined,
          selectedOptionIndex: localAnswer.selectedOptionIndex,
          hintsUsed: localAnswer.hintsUsed,
        },
      );

      set(state => ({
        answers: {
          ...state.answers,
          [questionId]: {
            ...localAnswer,
            score: data.score,
            feedback: data.feedback,
            marked: true,
          },
        },
        markingQuestionId: null,
        currentHint: null,
      }));
    } catch {
      set({ markingQuestionId: null });
    }
  },

  fetchHint: async (questionId) => {
    const { activeAttempt, answers } = get();
    if (!activeAttempt) return;

    const localAnswer = answers[questionId] ?? { hintsUsed: 0, marked: false, answerText: '' };
    set({ hintLoading: true, currentHint: null });

    try {
      const { data } = await api.post<{ hint: string; hintsUsed: number }>(
        `/api/exam/attempts/${activeAttempt.id}/hint`,
        { questionId, answerText: localAnswer.answerText || undefined },
      );

      set(state => ({
        currentHint: data.hint,
        hintLoading: false,
        answers: {
          ...state.answers,
          [questionId]: {
            ...localAnswer,
            hintsUsed: data.hintsUsed,
          },
        },
      }));
    } catch {
      set({ hintLoading: false });
    }
  },

  clearHint: () => set({ currentHint: null }),

  nextQuestion: () => {
    const { currentQuestionIndex, questions } = get();
    if (currentQuestionIndex < questions.length - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1, currentHint: null });
    } else {
      set({ practiceComplete: true });
    }
  },

  exitPractice: () => {
    set({
      activeAttempt: null,
      currentQuestionIndex: 0,
      answers: {},
      markingQuestionId: null,
      currentHint: null,
      practiceComplete: false,
    });
  },

  fetchReadiness: async (courseId) => {
    const { data } = await api.get<TopicReadiness[]>(`/api/exam/readiness/${courseId}`);
    set({ readiness: data ?? [] });
  },

  loadSessionBatch: async (formatId, topicId, chapterId) => {
    set({ sessionBatchLoading: true, sessionBatchError: null });
    try {
      // Always generate fresh questions — never show pre-stored/imported questions verbatim.
      // Scoped to chapter when set, otherwise topic.
      const { examDifficulty, requestedCount } = get();
      const { data } = await api.post<{ questions: ExamQuestion[] }>(
        `/api/exam/formats/${formatId}/questions`,
        { count: requestedCount, difficulty: examDifficulty, topicId, chapterId },
      );
      const questions = data.questions ?? [];
      set({
        sessionBankAll: questions,
        sessionBatch: questions,
        sessionBankOffset: questions.length,
        sessionAnswers: {},
        sessionBatchError: null,
      });
    } catch (err: unknown) {
      // Prefer the server's error body over the generic Axios status-code message
      const axiosData = (err as { response?: { data?: { error?: string } } })?.response?.data;
      const msg = axiosData?.error ?? (err instanceof Error ? err.message : 'Failed to generate questions');
      set({ sessionBatchError: msg });
    } finally {
      set({ sessionBatchLoading: false });
    }
  },

  loadMoreSessionBatch: async (formatId, topicId, chapterId) => {
    const { sessionBankAll, examDifficulty, requestedCount } = get();

    // Always generate new questions and append
    set({ sessionBatchGenerating: true });
    try {
      const { data } = await api.post<{ questions: ExamQuestion[] }>(
        `/api/exam/formats/${formatId}/questions`,
        { count: requestedCount, difficulty: examDifficulty, topicId, chapterId },
      );
      const newQs = data.questions ?? [];
      const all = [...sessionBankAll, ...newQs];
      set({
        sessionBankAll: all,
        sessionBatch: all,
        sessionBankOffset: all.length,
        // sessionAnswers NOT cleared — preserved
      });
    } finally {
      set({ sessionBatchGenerating: false });
    }
  },

  refreshBatchAtDifficulty: async (formatId, newDifficulty, topicId, chapterId) => {
    const clamped = Math.max(1, Math.min(5, newDifficulty));
    const { requestedCount } = get();
    // Clear current batch immediately and show loading spinner
    set({
      examDifficulty: clamped,
      sessionBatch: [],
      sessionBankAll: [],
      sessionBankOffset: 0,
      sessionAnswers: {},
      sessionBatchLoading: true,
    });
    try {
      const { data } = await api.post<{ questions: ExamQuestion[] }>(
        `/api/exam/formats/${formatId}/questions`,
        { count: requestedCount, difficulty: clamped, topicId, chapterId },
      );
      const newQs = data.questions ?? [];
      set({
        sessionBankAll: newQs,
        sessionBatch: newQs,
        sessionBankOffset: newQs.length,
      });
    } finally {
      set({ sessionBatchLoading: false });
    }
  },

  setSessionAnswerText: (questionId, text) => {
    set(state => ({
      sessionAnswers: {
        ...state.sessionAnswers,
        [questionId]: { ...(state.sessionAnswers[questionId] ?? { answerText: '', marked: false }), answerText: text },
      },
    }));
  },

  setSessionSelectedOption: (questionId, index) => {
    set(state => ({
      sessionAnswers: {
        ...state.sessionAnswers,
        [questionId]: { ...(state.sessionAnswers[questionId] ?? { answerText: '', marked: false }), selectedOptionIndex: index },
      },
    }));
  },

  submitSessionAnswer: async (questionId, files) => {
    const { sessionBatch, sessionAnswers } = get();
    const question = sessionBatch.find(q => q.id === questionId);
    if (!question) return;

    const local = sessionAnswers[questionId] ?? { answerText: '', marked: false };
    const isMcq = question.section_question_type === 'mcq';
    set({ sessionMarkingId: questionId });

    try {
      if (isMcq) {
        // Mark client-side instantly
        const correct = local.selectedOptionIndex === question.correct_option_index;
        set(state => ({
          sessionAnswers: {
            ...state.sessionAnswers,
            [questionId]: { ...local, score: correct ? question.max_marks : 0, marked: true,
              feedback: correct ? 'Correct!' : `Incorrect. The correct answer was: ${question.options?.[question.correct_option_index ?? 0] ?? ''}` },
          },
          sessionMarkingId: null,
        }));
      } else {
        // Always use FormData for written answers so we can attach files
        const form = new FormData();
        form.append('questionId', questionId);
        if (local.answerText) form.append('answerText', local.answerText);
        files?.forEach(f => form.append('files', f));

        const { data } = await api.post<{ score: number; maxMarks: number; feedback: string }>(
          '/api/exam/mark', form,
        );
        set(state => ({
          sessionAnswers: {
            ...state.sessionAnswers,
            [questionId]: { ...local, score: data.score, feedback: data.feedback, marked: true },
          },
          sessionMarkingId: null,
        }));
      }
    } catch (err: unknown) {
      const axiosResp = (err as { response?: { status?: number; data?: { error?: string } } })?.response;
      const questionMissing = axiosResp?.status === 404 && axiosResp?.data?.error === 'Question not found';
      if (questionMissing) {
        set({
          sessionMarkingId: null,
          sessionBankAll: [],
          sessionBatch: [],
          sessionBankOffset: 0,
          sessionAnswers: {},
          sessionHints: {},
          sessionFullAnswers: {},
          sessionHintLoading: null,
          sessionFullAnswerLoading: null,
          sessionBatchError: 'Your saved practice set is stale and no longer exists on the server. Click "Generate Questions" to load a fresh set.',
        });
        return;
      }
      set({ sessionMarkingId: null });
    }
  },

  fetchSessionHint: async (questionId, answerText) => {
    const { sessionHints } = get();
    const current = sessionHints[questionId];
    const hintsUsed = current?.count ?? 0;
    if (hintsUsed >= 2) return;
    set({ sessionHintLoading: questionId });
    try {
      const { data } = await api.post<{ hint: string }>('/api/exam/hint', {
        questionId, answerText, hintsUsed,
      });
      set(state => ({
        sessionHints: {
          ...state.sessionHints,
          [questionId]: { text: data.hint, count: hintsUsed + 1 },
        },
        sessionHintLoading: null,
      }));
    } catch (err: unknown) {
      const axiosResp = (err as { response?: { status?: number; data?: { error?: string } } })?.response;
      const questionMissing = axiosResp?.status === 404 && axiosResp?.data?.error === 'Question not found';
      if (questionMissing) {
        set({
          sessionHintLoading: null,
          sessionBankAll: [],
          sessionBatch: [],
          sessionBankOffset: 0,
          sessionAnswers: {},
          sessionHints: {},
          sessionFullAnswers: {},
          sessionBatchError: 'Your saved practice set is stale and no longer exists on the server. Click "Generate Questions" to load a fresh set.',
        });
        return;
      }
      set({ sessionHintLoading: null });
    }
  },

  clearSessionHint: (questionId) => {
    set(state => {
      const next = { ...state.sessionHints };
      delete next[questionId];
      return { sessionHints: next };
    });
  },

  fetchSessionFullAnswer: async (questionId) => {
    const { sessionFullAnswers } = get();
    if (sessionFullAnswers[questionId]) return; // already fetched
    set({ sessionFullAnswerLoading: questionId });
    try {
      const { data } = await api.post<{ answer: string }>('/api/exam/answer', { questionId });
      set(state => ({
        sessionFullAnswers: { ...state.sessionFullAnswers, [questionId]: data.answer },
        sessionFullAnswerLoading: null,
      }));
    } catch (err: unknown) {
      const axiosResp = (err as { response?: { status?: number; data?: { error?: string } } })?.response;
      const questionMissing = axiosResp?.status === 404 && axiosResp?.data?.error === 'Question not found';
      if (questionMissing) {
        set({
          sessionFullAnswerLoading: null,
          sessionBankAll: [],
          sessionBatch: [],
          sessionBankOffset: 0,
          sessionAnswers: {},
          sessionHints: {},
          sessionFullAnswers: {},
          sessionBatchError: 'Your saved practice set is stale and no longer exists on the server. Click "Generate Questions" to load a fresh set.',
        });
        return;
      }
      set({ sessionFullAnswerLoading: null });
    }
  },

  setExamDifficulty: (d) => set({ examDifficulty: Math.max(1, Math.min(5, d)) }),

  setRequestedCount: (n) => set({ requestedCount: n }),

  persistExamState: (sessionId) => {
    const { sessionBatch, sessionBankAll, sessionBankOffset, sessionAnswers, sessionHints, sessionFullAnswers, examDifficulty, requestedCount } = get();
    const payload = {
      schemaVersion: EXAM_CACHE_SCHEMA_VERSION,
      persistedAt: Date.now(),
      sessionBatch,
      sessionBankAll,
      sessionBankOffset,
      sessionAnswers,
      sessionHints,
      sessionFullAnswers,
      examDifficulty,
      requestedCount,
    };
    try {
      localStorage.setItem(
        'exam_practice_' + sessionId,
        JSON.stringify(payload),
      );
    } catch {
      // localStorage may be unavailable (private mode / quota exceeded)
      // Try without full answers (they're large) as a fallback
      try {
        localStorage.setItem(
          'exam_practice_' + sessionId,
          JSON.stringify({ ...payload, sessionFullAnswers: {} }),
        );
      } catch { /* give up */ }
    }
  },

  restoreExamState: (sessionId) => {
    try {
      const storageKey = 'exam_practice_' + sessionId;
      const raw = localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        schemaVersion?: number;
        persistedAt?: number;
        sessionBatch?: unknown[];
        sessionBankAll?: unknown[];
        sessionBankOffset?: number;
        sessionAnswers?: Record<string, unknown>;
        sessionHints?: Record<string, unknown>;
        sessionFullAnswers?: Record<string, string>;
        examDifficulty?: number;
        requestedCount?: number;
      };

      const isLegacyPayload = parsed.schemaVersion !== EXAM_CACHE_SCHEMA_VERSION || typeof parsed.persistedAt !== 'number';
      const isExpired = typeof parsed.persistedAt === 'number' && (Date.now() - parsed.persistedAt > EXAM_CACHE_TTL_MS);
      if (isLegacyPayload || isExpired) {
        localStorage.removeItem(storageKey);
        return false;
      }

      if (!Array.isArray(parsed.sessionBatch) || parsed.sessionBatch.length === 0) return false;
      const hasInvalidQuestionShape = parsed.sessionBatch.some((q) => {
        if (!q || typeof q !== 'object') return true;
        const obj = q as { id?: unknown; exam_format_id?: unknown };
        return typeof obj.id !== 'string' || typeof obj.exam_format_id !== 'string';
      });
      if (hasInvalidQuestionShape) {
        localStorage.removeItem(storageKey);
        return false;
      }

      set({
        sessionBatch: parsed.sessionBatch as ExamQuestion[],
        sessionBankAll: (parsed.sessionBankAll as ExamQuestion[] | undefined) ?? (parsed.sessionBatch as ExamQuestion[]),
        sessionBankOffset: parsed.sessionBankOffset ?? parsed.sessionBatch.length,
        sessionAnswers: parsed.sessionAnswers as Record<string, { answerText: string; selectedOptionIndex?: number; score?: number; feedback?: string; marked: boolean }> ?? {},
        sessionHints: parsed.sessionHints as Record<string, { text: string; count: number }> ?? {},
        sessionFullAnswers: parsed.sessionFullAnswers ?? {},
        examDifficulty: parsed.examDifficulty ?? 3,
        requestedCount: parsed.requestedCount ?? 5,
        // Reset any stuck loading states from a previous interrupted session
        sessionBatchLoading: false,
        sessionBatchGenerating: false,
        sessionBatchError: null,
        sessionFullAnswerLoading: null,
        sessionMarkingId: null,
        sessionHintLoading: null,
      });
      return true;
    } catch {
      return false;
    }
  },

  clearSessionExam: () => set({
    sessionBankAll: [],
    sessionBatch: [],
    sessionBankOffset: 0,
    sessionAnswers: {},
    sessionHints: {},
    sessionFullAnswers: {},
    sessionHintLoading: null,
    sessionFullAnswerLoading: null,
    sessionMarkingId: null,
    sessionBatchLoading: false,
    sessionBatchGenerating: false,
    sessionBatchError: null,
  }),

  extractPaper: async (files) => {
    set({ paperExtracting: true, extractedPaper: null });
    try {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      const { data } = await api.post<PaperPreview>('/api/exam/formats/extract-paper', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      set({ extractedPaper: data });
    } finally {
      set({ paperExtracting: false });
    }
  },

  clearExtractedPaper: () => set({ extractedPaper: null }),

  importPaper: async (courseId) => {
    const { extractedPaper } = get();
    if (!extractedPaper) throw new Error('No extracted paper to import');
    const { data } = await api.post<ExamFormat>('/api/exam/formats/import-questions', {
      courseId,
      name: extractedPaper.name,
      total_marks: extractedPaper.total_marks,
      time_minutes: extractedPaper.time_minutes,
      instructions: extractedPaper.instructions,
      sections: extractedPaper.sections,
      questions: extractedPaper.questions,
    });
    set(state => ({ formats: [data, ...state.formats], extractedPaper: null }));
    return data;
  },
}));
