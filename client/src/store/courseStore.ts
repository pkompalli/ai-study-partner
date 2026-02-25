import { create } from 'zustand';
import api from '@/lib/api';
import type { Course } from '@/types';

interface CourseState {
  courses: Course[];
  activeCourse: Course | null;
  loading: boolean;
  topicProgress: Record<string, { status: string; last_studied: string }>;
  chapterProgress: Record<string, { status: string; last_studied: string }>;
  fetchCourses: () => Promise<void>;
  fetchCourse: (id: string) => Promise<Course>;
  createCourse: (payload: unknown) => Promise<string>;
  updateCourse: (id: string, payload: Partial<Pick<Course, 'name' | 'description' | 'exam_name' | 'year_of_study'>>) => Promise<void>;
  replaceStructure: (id: string, subjects: Array<{ id?: string; name: string; topics: Array<{ id?: string; name: string }> }>) => Promise<Course>;
  deleteCourse: (id: string) => Promise<void>;
  setActiveCourse: (course: Course | null) => void;
  fetchTopicProgress: (courseId: string) => Promise<void>;
}

export const useCourseStore = create<CourseState>((set, get) => ({
  courses: [],
  activeCourse: null,
  loading: false,
  topicProgress: {},
  chapterProgress: {},

  fetchCourses: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get<Course[]>('/api/courses');
      set({ courses: data });
    } finally {
      set({ loading: false });
    }
  },

  fetchCourse: async (id) => {
    const { data } = await api.get<Course>(`/api/courses/${id}`);
    set({ activeCourse: data });
    return data;
  },

  createCourse: async (payload) => {
    const { data } = await api.post<{ id: string }>('/api/courses', payload);
    await get().fetchCourses();
    return data.id;
  },

  updateCourse: async (id, payload) => {
    const { data } = await api.patch<Course>(`/api/courses/${id}`, payload);
    set(state => ({
      courses: state.courses.map(c => c.id === id ? { ...c, ...data } : c),
      activeCourse: state.activeCourse?.id === id ? { ...state.activeCourse, ...data } : state.activeCourse,
    }));
  },

  replaceStructure: async (id, subjects) => {
    const { data } = await api.put<Course>(`/api/courses/${id}/structure`, { subjects });
    set(state => ({
      courses: state.courses.map(c => c.id === id ? { ...c, ...data } : c),
      activeCourse: state.activeCourse?.id === id ? { ...state.activeCourse, ...data } : state.activeCourse,
    }));
    return data;
  },

  deleteCourse: async (id) => {
    await api.delete(`/api/courses/${id}`);
    // Remove stale exam-practice localStorage entries for this course.
    // Topic-based keys have the format: exam_practice_<courseId>_<topicId>_<chapterId>
    const prefix = `exam_practice_${id}_`;
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
    set(state => ({ courses: state.courses.filter(c => c.id !== id) }));
  },

  setActiveCourse: (course) => set({ activeCourse: course }),

  fetchTopicProgress: async (courseId) => {
    const { data } = await api.get<{
      topicProgress: Record<string, { status: string; last_studied: string }>;
      chapterProgress: Record<string, { status: string; last_studied: string }>;
    }>(`/api/courses/${courseId}/progress`);
    set({ topicProgress: data.topicProgress ?? {}, chapterProgress: data.chapterProgress ?? {} });
  },
}));
