import { create } from 'zustand';
import api from '@/lib/api';
import type {
  ExamFormat, ExamSection, ExamQuestion, ExamAttempt, LocalAnswerState, TopicReadiness, MarkCriterion,
} from '@/types';

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
  sessionBankOffset: number;
  sessionAnswers: Record<string, { answerText: string; selectedOptionIndex?: number; score?: number; feedback?: string; marked: boolean }>;
  sessionMarkingId: string | null;
  sessionBatchLoading: boolean;
  sessionBatchGenerating: boolean;
  examDifficulty: number;

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
  setExamDifficulty: (d: number) => void;
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
  sessionMarkingId: null,
  sessionBatchLoading: false,
  sessionBatchGenerating: false,
  examDifficulty: 3,

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
    set({ sessionBatchLoading: true });
    try {
      // Always generate fresh questions — never show pre-stored/imported questions verbatim.
      // Scoped to chapter when set, otherwise topic.
      const { examDifficulty } = get();
      const { data } = await api.post<{ questions: ExamQuestion[] }>(
        `/api/exam/formats/${formatId}/questions/batch`,
        { count: 5, difficulty: examDifficulty, topicId, chapterId },
      );
      const questions = data.questions ?? [];
      set({
        sessionBankAll: questions,
        sessionBatch: questions.slice(0, 5),
        sessionBankOffset: Math.min(5, questions.length),
        sessionAnswers: {},
      });
    } finally {
      set({ sessionBatchLoading: false });
    }
  },

  loadMoreSessionBatch: async (formatId, topicId, chapterId) => {
    const { sessionBankAll, sessionBankOffset, examDifficulty } = get();
    const remaining = sessionBankAll.slice(sessionBankOffset, sessionBankOffset + 5);

    if (remaining.length >= 5) {
      set({
        sessionBatch: remaining,
        sessionBankOffset: sessionBankOffset + 5,
        sessionAnswers: {},
      });
      return;
    }

    // Need to generate more questions
    set({ sessionBatchGenerating: true });
    try {
      const { data } = await api.post<{ questions: ExamQuestion[] }>(
        `/api/exam/formats/${formatId}/questions/batch`,
        { count: 5, difficulty: examDifficulty, topicId, chapterId },
      );
      const newQs = data.questions ?? [];
      const all = [...sessionBankAll, ...newQs];
      const nextBatch = all.slice(sessionBankOffset, sessionBankOffset + 5);
      set({
        sessionBankAll: all,
        sessionBatch: nextBatch,
        sessionBankOffset: sessionBankOffset + nextBatch.length,
        sessionAnswers: {},
      });
    } finally {
      set({ sessionBatchGenerating: false });
    }
  },

  refreshBatchAtDifficulty: async (formatId, newDifficulty, topicId, chapterId) => {
    const clamped = Math.max(1, Math.min(5, newDifficulty));
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
        `/api/exam/formats/${formatId}/questions/batch`,
        { count: 5, difficulty: clamped, topicId, chapterId },
      );
      const newQs = data.questions ?? [];
      set({
        sessionBankAll: newQs,
        sessionBatch: newQs.slice(0, 5),
        sessionBankOffset: Math.min(5, newQs.length),
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
    } catch {
      set({ sessionMarkingId: null });
    }
  },

  setExamDifficulty: (d) => set({ examDifficulty: Math.max(1, Math.min(5, d)) }),

  clearSessionExam: () => set({
    sessionBankAll: [],
    sessionBatch: [],
    sessionBankOffset: 0,
    sessionAnswers: {},
    sessionMarkingId: null,
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
