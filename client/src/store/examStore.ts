import { create } from 'zustand';
import api from '@/lib/api';
import type {
  ExamFormat, ExamSection, ExamQuestion, ExamAttempt, LocalAnswerState, TopicReadiness,
} from '@/types';

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
}));
