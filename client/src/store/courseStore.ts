import { create } from 'zustand';
import api from '@/lib/api';
import type { Course } from '@/types';

interface CourseState {
  courses: Course[];
  activeCourse: Course | null;
  loading: boolean;
  topicProgress: Record<string, { status: string; last_studied: string }>;
  fetchCourses: () => Promise<void>;
  fetchCourse: (id: string) => Promise<Course>;
  createCourse: (payload: unknown) => Promise<string>;
  deleteCourse: (id: string) => Promise<void>;
  setActiveCourse: (course: Course | null) => void;
  fetchTopicProgress: (courseId: string) => Promise<void>;
}

export const useCourseStore = create<CourseState>((set, get) => ({
  courses: [],
  activeCourse: null,
  loading: false,
  topicProgress: {},

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

  deleteCourse: async (id) => {
    await api.delete(`/api/courses/${id}`);
    set(state => ({ courses: state.courses.filter(c => c.id !== id) }));
  },

  setActiveCourse: (course) => set({ activeCourse: course }),

  fetchTopicProgress: async (courseId) => {
    const { data } = await api.get<Record<string, { status: string; last_studied: string }>>(`/api/courses/${courseId}/progress`);
    set({ topicProgress: data });
  },
}));
