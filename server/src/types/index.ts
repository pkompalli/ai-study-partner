export interface CourseStructure {
  subjects: Subject[];
}

export interface Subject {
  name: string;
  description?: string;
  topics: Topic[];
}

export interface Topic {
  name: string;
  chapters: Chapter[];
}

export interface Chapter {
  name: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  mnemonic?: string;
}

export interface VideoLink {
  title: string;
  url: string;
  channelTitle: string;
  description: string;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type?: 'text' | 'quiz' | 'flashcards' | 'videos';
  metadata?: Record<string, unknown>;
}
