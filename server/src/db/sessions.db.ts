import { randomUUID } from 'crypto';
import { db } from '../config/database.js';
import type { SessionMessage } from '../types/index.js';

export function createSession(
  userId: string,
  courseId: string,
  topicId?: string,
  chapterId?: string
): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO study_sessions (id, user_id, course_id, topic_id, chapter_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, courseId, topicId ?? null, chapterId ?? null);
  return id;
}

export function getSession(sessionId: string, userId: string) {
  const session = db.prepare('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
  if (!session) throw new Error('Session not found');
  return session as Record<string, unknown>;
}

export function getSessionMessages(sessionId: string): SessionMessage[] {
  const rows = db.prepare(
    'SELECT role, content, content_type, metadata, created_at FROM session_messages WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as Array<{ role: string; content: string; content_type: string; metadata: string; created_at: string }>;

  return rows.map(row => ({
    role: row.role as SessionMessage['role'],
    content: row.content,
    content_type: row.content_type as SessionMessage['content_type'],
    metadata: JSON.parse(row.metadata ?? '{}'),
  }));
}

export function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  contentType = 'text',
  metadata: Record<string, unknown> = {}
): void {
  db.prepare(`
    INSERT INTO session_messages (id, session_id, role, content, content_type, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), sessionId, role, content, contentType, JSON.stringify(metadata));
}

export function endSession(sessionId: string, userId: string): void {
  db.prepare(
    "UPDATE study_sessions SET status = 'ended', ended_at = ? WHERE id = ? AND user_id = ?"
  ).run(new Date().toISOString(), sessionId, userId);
}

export function listSessions(userId: string, courseId?: string) {
  if (courseId) {
    return db.prepare(
      'SELECT id, course_id, topic_id, title, status, started_at, ended_at FROM study_sessions WHERE user_id = ? AND course_id = ? ORDER BY started_at DESC'
    ).all(userId, courseId);
  }
  return db.prepare(
    'SELECT id, course_id, topic_id, title, status, started_at, ended_at FROM study_sessions WHERE user_id = ? ORDER BY started_at DESC'
  ).all(userId);
}

export function saveQuiz(
  sessionId: string,
  userId: string,
  topicId: string | undefined,
  questions: unknown
): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO quizzes (id, session_id, user_id, topic_id, questions, total)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, userId, topicId ?? null, JSON.stringify(questions), (questions as unknown[]).length);
  return id;
}

export function getQuiz(quizId: string, userId: string) {
  const row = db.prepare('SELECT * FROM quizzes WHERE id = ? AND user_id = ?').get(quizId, userId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  row['questions'] = JSON.parse(row['questions'] as string);
  if (row['answers']) row['answers'] = JSON.parse(row['answers'] as string);
  return row;
}

export function submitQuizAnswers(
  quizId: string,
  userId: string,
  answers: Record<string, number>,
  score: number,
  total: number
): void {
  db.prepare(
    'UPDATE quizzes SET answers = ?, score = ?, total = ?, completed_at = ? WHERE id = ? AND user_id = ?'
  ).run(JSON.stringify(answers), score, total, new Date().toISOString(), quizId, userId);
}

export function saveFlashcardSet(
  sessionId: string,
  userId: string,
  topicId: string | undefined,
  cards: unknown
): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO flashcard_sets (id, session_id, user_id, topic_id, cards)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, sessionId, userId, topicId ?? null, JSON.stringify(cards));
  return id;
}

export function getTopicProgressForCourse(
  userId: string,
  courseId: string,
): Record<string, { status: string; last_studied: string }> {
  const rows = db.prepare(
    'SELECT topic_id, status, last_studied FROM topic_progress WHERE user_id = ? AND course_id = ?'
  ).all(userId, courseId) as Array<{ topic_id: string; status: string; last_studied: string }>;
  return Object.fromEntries(rows.map(r => [r.topic_id, { status: r.status, last_studied: r.last_studied }]));
}

export function upsertTopicProgress(
  userId: string,
  topicId: string,
  courseId: string,
  status: string
): void {
  const existing = db.prepare('SELECT id FROM topic_progress WHERE user_id = ? AND topic_id = ?').get(userId, topicId);
  if (existing) {
    db.prepare(
      'UPDATE topic_progress SET status = ?, last_studied = ? WHERE user_id = ? AND topic_id = ?'
    ).run(status, new Date().toISOString(), userId, topicId);
  } else {
    db.prepare(`
      INSERT INTO topic_progress (id, user_id, topic_id, course_id, status, last_studied)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), userId, topicId, courseId, status, new Date().toISOString());
  }
}

// ─── Topic summary cache ──────────────────────────────────────────────────────

export interface CachedSummary {
  depth: number;
  summary: string;
  question: string;
  answer_pills: string[];
  correct_index: number;
  explanation: string;
  starters: string[];
}

export function getCachedSummary(userId: string, topicId: string, depth: number): CachedSummary | null {
  const row = db.prepare(
    'SELECT * FROM topic_summaries WHERE topic_id = ? AND user_id = ? AND depth = ?'
  ).get(topicId, userId, depth) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    depth: row['depth'] as number,
    summary: row['summary'] as string,
    question: row['question'] as string,
    answer_pills: JSON.parse(row['answer_pills'] as string),
    correct_index: row['correct_index'] as number,
    explanation: row['explanation'] as string,
    starters: JSON.parse(row['starters'] as string),
  };
}

export function getLastCachedDepth(userId: string, topicId: string): number | null {
  const row = db.prepare(
    'SELECT depth FROM topic_summaries WHERE topic_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 1'
  ).get(topicId, userId) as { depth: number } | undefined;
  return row?.depth ?? null;
}

export function saveSummaryCache(
  userId: string,
  topicId: string,
  depth: number,
  data: {
    summary: string;
    question: string;
    answer_pills: string[];
    correct_index: number;
    explanation: string;
    starters: string[];
  },
): void {
  db.prepare(`
    INSERT INTO topic_summaries (topic_id, user_id, depth, summary, question, answer_pills, correct_index, explanation, starters, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(topic_id, user_id, depth) DO UPDATE SET
      summary = excluded.summary,
      question = excluded.question,
      answer_pills = excluded.answer_pills,
      correct_index = excluded.correct_index,
      explanation = excluded.explanation,
      starters = excluded.starters,
      updated_at = excluded.updated_at
  `).run(
    topicId, userId, depth,
    data.summary, data.question,
    JSON.stringify(data.answer_pills),
    data.correct_index,
    data.explanation,
    JSON.stringify(data.starters),
  );
}
