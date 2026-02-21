export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  year_of_study?: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  name: string;
  sort_order: number;
}

export interface Topic {
  id: string;
  name: string;
  sort_order: number;
  chapters: Chapter[];
}

export interface Subject {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  topics: Topic[];
}

export interface Course {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  goal: 'exam_prep' | 'classwork';
  exam_name?: string;
  year_of_study?: string;
  source_type?: string;
  source_file_url?: string;
  structure: { subjects: Subject[] };
  is_active: boolean;
  created_at: string;
  subjects?: Subject[];
}

export interface StudySession {
  id: string;
  course_id: string;
  topic_id?: string;
  chapter_id?: string;
  title?: string;
  status: 'active' | 'ended' | 'abandoned';
  started_at: string;
  ended_at?: string;
}

export interface CheckQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  depth?: number;
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
  depth?: number;
  // Spaced-repetition fields (present for topic-bank cards)
  ease_factor?: number;
  interval_days?: number;
  times_seen?: number;
  times_correct?: number;
  next_review_at?: string;
  last_reviewed_at?: string;
}

export interface VideoLink {
  title: string;
  url: string;
  channelTitle: string;
  description: string;
}

export interface SessionMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type: 'text' | 'quiz' | 'flashcards' | 'videos';
  metadata?: Record<string, unknown>;
  created_at?: string;
  depth?: number;
}

export interface LessonArtifact {
  id: string;
  session_id: string;
  course_id: string;
  topic_id?: string;
  title: string;
  markdown_content: string;
  pdf_url?: string;
  created_at: string;
}

export interface CrossTopicCard {
  id: string;
  front: string;
  back: string;
  mnemonic?: string;
  source_topic_id: string;
  source_topic_name: string;
  score: number;
}

export interface TopicProgress {
  topic_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  sessions_count: number;
  last_studied?: string;
}
