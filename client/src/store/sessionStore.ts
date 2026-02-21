import { create } from 'zustand';
import api from '@/lib/api';
import type { StudySession, SessionMessage, QuizQuestion, Flashcard, VideoLink, CheckQuestion } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface SessionState {
  activeSession: StudySession | null;
  messages: SessionMessage[];
  isStreaming: boolean;
  streamingContent: string;
  regeneratingIndex: number | null;
  activeQuiz: { id: string; questions: QuizQuestion[] } | null;
  activeFlashcards: { id: string; cards: Flashcard[] } | null;
  activeVideos: VideoLink[] | null;
  topicSummary: { summary: string; checkQuestions: CheckQuestion[]; starters: string[] } | null;
  summaryStreaming: boolean;
  summaryStreamingContent: string;
  responsePills: { checkQuestions: CheckQuestion[]; followupPills: string[] } | null;
  pillsLoading: boolean;
  flashcardsLoading: boolean;
  // Accumulates check questions across the session; resets only on depth/summary change
  accumulatedCheckQuestions: CheckQuestion[];
  checkResetKey: number;

  startSession: (courseId: string, topicId?: string, chapterId?: string) => Promise<string>;
  loadSession: (sessionId: string) => Promise<void>;
  sendMessage: (content: string, depth?: number) => Promise<void>;
  requestQuiz: () => Promise<void>;
  requestFlashcards: () => Promise<void>;
  requestVideos: () => Promise<void>;
  submitQuizAnswers: (quizId: string, answers: Record<string, number>) => Promise<{ score: number; total: number }>;
  endSession: () => Promise<string>;
  clearSession: () => void;
  fetchSummary: (sessionId: string, depth?: number, resetPanel?: boolean) => Promise<void>;
  fetchPills: (sessionId: string) => Promise<void>;
  fetchTopicBank: (sessionId: string) => Promise<void>;
  silentFetchFlashcards: (depth?: number) => Promise<void>;
  reviewCard: (cardId: string, correct: boolean) => Promise<void>;
  regenerateMessage: (visibleIndex: number, depth: number) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  regeneratingIndex: null,
  activeQuiz: null,
  activeFlashcards: null,
  activeVideos: null,
  topicSummary: null,
  summaryStreaming: false,
  summaryStreamingContent: '',
  responsePills: null,
  pillsLoading: false,
  flashcardsLoading: false,
  accumulatedCheckQuestions: [],
  checkResetKey: 0,

  startSession: async (courseId, topicId, chapterId) => {
    const { data } = await api.post<{ id: string }>('/api/sessions', { courseId, topicId, chapterId });
    const sessionId = data.id;
    await get().loadSession(sessionId);
    return sessionId;
  },

  loadSession: async (sessionId) => {
    const { data } = await api.get<StudySession & { messages: SessionMessage[] }>(`/api/sessions/${sessionId}`);
    const { messages, ...session } = data;
    set({ activeSession: session, messages: messages ?? [], responsePills: null });
    // Load topic bank in the background — cards and questions appear immediately for returning students
    get().fetchTopicBank(sessionId).catch(() => {});
  },

  sendMessage: async (content, depth) => {
    const session = get().activeSession;
    if (!session) return;

    const userMsg: SessionMessage = { role: 'user', content, content_type: 'text' };
    // Keep followupPills visible during streaming so the Explore bar doesn't vanish
    // accumulatedCheckQuestions stays intact — panel shows existing questions while streaming
    set(state => ({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingContent: '',
      responsePills: state.responsePills
        ? { checkQuestions: state.responsePills.checkQuestions, followupPills: state.responsePills.followupPills }
        : null,
    }));

    const response = await fetch(`${API_BASE}/api/sessions/${session.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ content, depth }),
    });

    if (!response.ok || !response.body) {
      set({ isStreaming: false });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === 'chunk') {
            accumulated += json.content;
            set({ streamingContent: accumulated });
          } else if (json.type === 'done') {
            set(state => ({
              messages: [...state.messages, {
                role: 'assistant',
                content: accumulated,
                content_type: 'text',
                depth: depth ?? 0,
              }],
              isStreaming: false,
              streamingContent: '',
              pillsLoading: true,
            }));
          }
        } catch { /* ignore parse errors */ }
      }
    }

    set({ isStreaming: false });
    get().fetchPills(session.id).finally(() => set({ pillsLoading: false }));
  },

  requestQuiz: async () => {
    const session = get().activeSession;
    if (!session) return;
    const { data } = await api.post<{ id: string; questions: QuizQuestion[] }>(`/api/sessions/${session.id}/quiz`);
    set({ activeQuiz: data });
    const msg: SessionMessage = {
      role: 'assistant',
      content: 'Here is your quiz!',
      content_type: 'quiz',
      metadata: { quizId: data.id, questions: data.questions },
    };
    set(state => ({ messages: [...state.messages, msg] }));
  },

  requestFlashcards: async () => {
    const session = get().activeSession;
    if (!session) return;
    const { data } = await api.post<{ id: string; cards: Flashcard[] }>(`/api/sessions/${session.id}/flashcards`);
    set({ activeFlashcards: data });
    const msg: SessionMessage = {
      role: 'assistant',
      content: 'Here are your flashcards!',
      content_type: 'flashcards',
      metadata: { setId: data.id, cards: data.cards },
    };
    set(state => ({ messages: [...state.messages, msg] }));
  },

  requestVideos: async () => {
    const session = get().activeSession;
    if (!session) return;
    const { data } = await api.post<{ videos: VideoLink[] }>(`/api/sessions/${session.id}/videos`);
    set({ activeVideos: data.videos });
    const msg: SessionMessage = {
      role: 'assistant',
      content: 'Here are some helpful videos!',
      content_type: 'videos',
      metadata: { videos: data.videos },
    };
    set(state => ({ messages: [...state.messages, msg] }));
  },

  submitQuizAnswers: async (quizId, answers) => {
    const { data } = await api.post<{ score: number; total: number }>(`/api/quizzes/${quizId}/submit`, { answers });
    return data;
  },

  endSession: async () => {
    const session = get().activeSession;
    if (!session) throw new Error('No active session');
    const { data } = await api.patch<{ artifactId: string }>(`/api/sessions/${session.id}/end`);
    set({ activeSession: { ...session, status: 'ended' } });
    return data.artifactId;
  },

  clearSession: () => {
    set({
      activeSession: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
      regeneratingIndex: null,
      activeQuiz: null,
      activeFlashcards: null,
      activeVideos: null,
      topicSummary: null,
      summaryStreaming: false,
      summaryStreamingContent: '',
      responsePills: null,
      pillsLoading: false,
      flashcardsLoading: false,
      accumulatedCheckQuestions: [],
      checkResetKey: 0,
    });
  },

  fetchSummary: async (sessionId, depth = 0, resetPanel = false) => {
    set({ summaryStreaming: true, summaryStreamingContent: '', topicSummary: null });

    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}/summary?depth=${depth}`, {
        headers: authHeaders(),
      });

      if (!response.ok || !response.body) {
        set({ summaryStreaming: false });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.type === 'chunk') {
              accumulated += json.content;
              set({ summaryStreamingContent: accumulated });
            } else if (json.type === 'done') {
              const summaryQuestions: CheckQuestion[] = json.questions ?? [];
              set(state => {
                let nextAccumulated: CheckQuestion[];
                let nextResetKey = state.checkResetKey;

                if (resetPanel) {
                  // Explicit depth change: fresh deck for this depth
                  nextAccumulated = summaryQuestions;
                  nextResetKey = state.checkResetKey + 1;
                } else {
                  // Initial load or background refresh: append only truly new questions
                  const existingTexts = new Set(state.accumulatedCheckQuestions.map(q => q.question));
                  const novel = summaryQuestions.filter(q => !existingTexts.has(q.question));
                  nextAccumulated = [...state.accumulatedCheckQuestions, ...novel];
                }

                return {
                  topicSummary: {
                    summary: accumulated,
                    checkQuestions: summaryQuestions,
                    starters: json.starters ?? [],
                  },
                  summaryStreaming: false,
                  summaryStreamingContent: '',
                  accumulatedCheckQuestions: nextAccumulated,
                  checkResetKey: nextResetKey,
                };
              });
              // Auto-generate flashcards silently for the sidebar
              get().silentFetchFlashcards(depth).catch(() => {});
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    set({ summaryStreaming: false });
  },

  fetchPills: async (sessionId) => {
    const { data } = await api.get<{ questions: CheckQuestion[]; followupPills: string[] }>(
      `/api/sessions/${sessionId}/pills`
    );
    const newQuestions: CheckQuestion[] = data.questions ?? [];
    set(state => {
      const existingTexts = new Set(state.accumulatedCheckQuestions.map(q => q.question));
      const novel = newQuestions.filter(q => !existingTexts.has(q.question));
      return {
        responsePills: { checkQuestions: newQuestions, followupPills: data.followupPills ?? [] },
        accumulatedCheckQuestions: [...state.accumulatedCheckQuestions, ...novel],
      };
    });
  },

  fetchTopicBank: async (sessionId) => {
    try {
      const [cardsRes, questionsRes] = await Promise.all([
        api.get<{ cards: Flashcard[] }>(`/api/sessions/${sessionId}/topic-cards`),
        api.get<{ questions: CheckQuestion[] }>(`/api/sessions/${sessionId}/topic-questions`),
      ]);
      const cards = cardsRes.data.cards ?? [];
      const questions = questionsRes.data.questions ?? [];

      if (cards.length > 0) {
        set({ activeFlashcards: { id: 'topic-bank', cards } });
      }
      if (questions.length > 0) {
        // Seed the accumulated deck; don't bump resetKey (this is history, not a depth change)
        set(state => {
          const existingTexts = new Set(state.accumulatedCheckQuestions.map(q => q.question));
          const novel = questions.filter(q => !existingTexts.has(q.question));
          return novel.length > 0
            ? { accumulatedCheckQuestions: [...state.accumulatedCheckQuestions, ...novel] }
            : {};
        });
      }
    } catch { /* ignore — topic bank may be empty for new topics */ }
  },

  silentFetchFlashcards: async (depth = 0) => {
    const session = get().activeSession;
    if (!session) return;
    set({ flashcardsLoading: true });
    try {
      const { data } = await api.post<{ id: string; cards: Flashcard[] }>(
        `/api/sessions/${session.id}/flashcards?silent=true&depth=${depth}`
      );
      set({ activeFlashcards: data });
    } catch { /* ignore */ } finally {
      set({ flashcardsLoading: false });
    }
  },

  reviewCard: async (cardId, correct) => {
    const session = get().activeSession;
    if (!session) return;
    try {
      const { data } = await api.patch<{
        cardId: string; intervalDays: number; easeFactor: number;
        timesSeen: number; timesCorrect: number; nextReviewAt: string;
      }>(`/api/sessions/${session.id}/card-review`, { cardId, correct });

      // Patch the card in-place so the deck re-sorts without a full reload
      set(state => {
        if (!state.activeFlashcards) return {};
        return {
          activeFlashcards: {
            ...state.activeFlashcards,
            cards: state.activeFlashcards.cards.map(c =>
              c.id === data.cardId
                ? { ...c, interval_days: data.intervalDays, ease_factor: data.easeFactor,
                    times_seen: data.timesSeen, times_correct: data.timesCorrect,
                    next_review_at: data.nextReviewAt }
                : c
            ),
          },
        };
      });
    } catch { /* ignore */ }
  },

  regenerateMessage: async (visibleIndex, depth) => {
    const session = get().activeSession;
    if (!session) return;

    const messages = get().messages;
    let count = 0;
    let fullIndex = -1;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role !== 'system') {
        if (count === visibleIndex) {
          fullIndex = i;
          break;
        }
        count++;
      }
    }
    if (fullIndex === -1) return;

    set({ isStreaming: true, streamingContent: '', regeneratingIndex: visibleIndex });

    const response = await fetch(`${API_BASE}/api/sessions/${session.id}/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ messageIndex: visibleIndex, depth }),
    });

    if (!response.ok || !response.body) {
      set({ isStreaming: false, regeneratingIndex: null });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === 'chunk') {
            accumulated += json.content;
            set({ streamingContent: accumulated });
          } else if (json.type === 'done') {
            set(state => {
              const newMessages = [...state.messages];
              newMessages[fullIndex] = {
                ...newMessages[fullIndex],
                content: accumulated,
                depth,
              };
              return {
                messages: newMessages,
                isStreaming: false,
                streamingContent: '',
                regeneratingIndex: null,
                pillsLoading: true,
              };
            });
          }
        } catch { /* ignore */ }
      }
    }

    set({ isStreaming: false, regeneratingIndex: null });
    get().fetchPills(session.id).finally(() => set({ pillsLoading: false }));
  },
}));
