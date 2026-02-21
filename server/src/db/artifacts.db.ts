import { randomUUID } from 'crypto';
import { db } from '../config/database.js';

export function saveArtifact(
  sessionId: string,
  userId: string,
  courseId: string,
  topicId: string | undefined,
  title: string,
  markdownContent: string
): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO lesson_artifacts (id, session_id, user_id, course_id, topic_id, title, markdown_content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, userId, courseId, topicId ?? null, title, markdownContent);
  return id;
}

export interface ArtifactRow {
  id: string;
  session_id: string;
  user_id: string;
  course_id: string;
  topic_id: string | null;
  title: string;
  markdown_content: string;
  pdf_url: string | null;
  created_at: string;
}

export function getArtifact(artifactId: string, userId: string): ArtifactRow {
  const row = db.prepare('SELECT * FROM lesson_artifacts WHERE id = ? AND user_id = ?').get(artifactId, userId) as ArtifactRow | undefined;
  if (!row) throw new Error('Artifact not found');
  return row;
}

export function updateArtifactPdfUrl(artifactId: string, pdfUrl: string): void {
  db.prepare('UPDATE lesson_artifacts SET pdf_url = ? WHERE id = ?').run(pdfUrl, artifactId);
}

export function listArtifacts(userId: string, sessionId?: string) {
  if (sessionId) {
    return db.prepare(
      'SELECT id, session_id, course_id, topic_id, title, pdf_url, created_at FROM lesson_artifacts WHERE user_id = ? AND session_id = ? ORDER BY created_at DESC'
    ).all(userId, sessionId);
  }
  return db.prepare(
    'SELECT id, session_id, course_id, topic_id, title, pdf_url, created_at FROM lesson_artifacts WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
}
