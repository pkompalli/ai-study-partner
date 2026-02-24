import { randomUUID } from 'crypto';
import { db } from '../config/database.js';

export interface TopicCard {
  id: string;
  front: string;
  back: string;
  mnemonic?: string;
  depth: number;
  ease_factor: number;
  interval_days: number;
  times_seen: number;
  times_correct: number;
  next_review_at?: string;
  last_reviewed_at?: string;
  created_at: string;
}

export interface TopicCheckQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  depth: number;
  created_at: string;
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export function getTopicCards(userId: string, topicId: string, chapterId?: string): TopicCard[] {
  if (chapterId) {
    return (db.prepare(`
      SELECT id, front, back, mnemonic, depth,
             ease_factor, interval_days, times_seen, times_correct,
             next_review_at, last_reviewed_at, created_at
      FROM topic_cards
      WHERE user_id = ? AND topic_id = ? AND chapter_id = ?
      ORDER BY created_at ASC
    `).all(userId, topicId, chapterId) as TopicCard[]);
  }
  return (db.prepare(`
    SELECT id, front, back, mnemonic, depth,
           ease_factor, interval_days, times_seen, times_correct,
           next_review_at, last_reviewed_at, created_at
    FROM topic_cards
    WHERE user_id = ? AND topic_id = ? AND chapter_id IS NULL
    ORDER BY created_at ASC
  `).all(userId, topicId) as TopicCard[]);
}

export function getTopicCardFronts(userId: string, topicId: string, chapterId?: string): string[] {
  if (chapterId) {
    return (db.prepare(
      'SELECT front FROM topic_cards WHERE user_id = ? AND topic_id = ? AND chapter_id = ?'
    ).all(userId, topicId, chapterId) as { front: string }[]).map(r => r.front);
  }
  return (db.prepare(
    'SELECT front FROM topic_cards WHERE user_id = ? AND topic_id = ? AND chapter_id IS NULL'
  ).all(userId, topicId) as { front: string }[]).map(r => r.front);
}

export function saveTopicCards(
  userId: string,
  topicId: string,
  courseId: string,
  sessionId: string,
  depth: number,
  cards: Array<{ front: string; back: string; mnemonic?: string | null }>,
  chapterId?: string,
): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO topic_cards
      (id, user_id, topic_id, course_id, session_id, chapter_id, front, back, mnemonic, depth)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction((items: typeof cards) => {
    for (const c of items) {
      insert.run(randomUUID(), userId, topicId, courseId, sessionId,
        chapterId ?? null, c.front, c.back, c.mnemonic ?? null, depth);
    }
  })(cards);
}

export function saveSingleCard(
  userId: string,
  topicId: string,
  courseId: string,
  sessionId: string,
  front: string,
  back: string,
  chapterId?: string,
): TopicCard | null {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO topic_cards
      (id, user_id, topic_id, course_id, session_id, chapter_id, front, back, mnemonic, depth)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0)
  `);
  const result = stmt.run(id, userId, topicId, courseId, sessionId, chapterId ?? null, front, back);

  if (result.changes === 0) {
    // Already saved — return existing card
    const q = chapterId
      ? 'SELECT id, front, back, mnemonic, depth, ease_factor, interval_days, times_seen, times_correct, next_review_at, last_reviewed_at, created_at FROM topic_cards WHERE user_id = ? AND topic_id = ? AND chapter_id = ? AND front = ?'
      : 'SELECT id, front, back, mnemonic, depth, ease_factor, interval_days, times_seen, times_correct, next_review_at, last_reviewed_at, created_at FROM topic_cards WHERE user_id = ? AND topic_id = ? AND chapter_id IS NULL AND front = ?';
    return (chapterId
      ? db.prepare(q).get(userId, topicId, chapterId, front)
      : db.prepare(q).get(userId, topicId, front)) as TopicCard ?? null;
  }

  return db.prepare(`
    SELECT id, front, back, mnemonic, depth, ease_factor, interval_days,
           times_seen, times_correct, next_review_at, last_reviewed_at, created_at
    FROM topic_cards WHERE id = ?
  `).get(id) as TopicCard ?? null;
}

// ─── SM-2 review ─────────────────────────────────────────────────────────────

export interface ReviewResult {
  cardId: string;
  intervalDays: number;
  easeFactor: number;
  timesSeen: number;
  timesCorrect: number;
  nextReviewAt: string;
}

export function reviewTopicCard(
  userId: string,
  cardId: string,
  correct: boolean,
): ReviewResult | null {
  const row = db.prepare(`
    SELECT ease_factor, interval_days, times_seen, times_correct
    FROM topic_cards WHERE id = ? AND user_id = ?
  `).get(cardId, userId) as {
    ease_factor: number; interval_days: number;
    times_seen: number; times_correct: number;
  } | undefined;

  if (!row) return null;

  let ease = row.ease_factor ?? 2.5;
  let interval = row.interval_days ?? 1;
  let timesSeen = (row.times_seen ?? 0) + 1;
  let timesCorrect = row.times_correct ?? 0;

  if (correct) {
    timesCorrect++;
    // SM-2 interval progression
    if (timesCorrect === 1)      interval = 1;
    else if (timesCorrect === 2) interval = 3;
    else                          interval = Math.round(interval * ease);
    ease = Math.min(3.0, ease + 0.1);
  } else {
    // Wrong: review again in 1 day, slightly reduce ease
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  }

  const nextReviewAt = new Date(Date.now() + interval * 86_400_000).toISOString();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE topic_cards
    SET ease_factor = ?, interval_days = ?, times_seen = ?, times_correct = ?,
        next_review_at = ?, last_reviewed_at = ?
    WHERE id = ? AND user_id = ?
  `).run(ease, interval, timesSeen, timesCorrect, nextReviewAt, now, cardId, userId);

  return { cardId, intervalDays: interval, easeFactor: ease,
           timesSeen, timesCorrect, nextReviewAt };
}

// ─── Cross-topic surfacing ────────────────────────────────────────────────────

export interface CrossTopicCard {
  id: string;
  front: string;
  back: string;
  mnemonic?: string;
  source_topic_id: string;
  source_topic_name: string;
  score: number;
}

/**
 * Returns up to `limit` cards from OTHER topics in the same course whose
 * front/back text shares keywords with `currentTopicName`.
 * Scoring: count of topic-name words (length > 3) that appear in card text.
 */
export function getCrossTopicCards(
  userId: string,
  courseId: string,
  currentTopicId: string,
  currentTopicName: string,
  limit = 3,
): CrossTopicCard[] {
  const rows = db.prepare(`
    SELECT tc.id, tc.front, tc.back, tc.mnemonic,
           tc.topic_id AS source_topic_id,
           t.name      AS source_topic_name
    FROM topic_cards tc
    JOIN topics t ON tc.topic_id = t.id
    WHERE tc.user_id   = ?
      AND tc.course_id = ?
      AND tc.topic_id != ?
    ORDER BY tc.times_correct DESC, tc.created_at DESC
  `).all(userId, courseId, currentTopicId) as Array<{
    id: string; front: string; back: string; mnemonic?: string;
    source_topic_id: string; source_topic_name: string;
  }>;

  if (rows.length === 0) return [];

  // Words from the current topic name that are long enough to be meaningful
  const keywords = currentTopicName
    .toLowerCase()
    .split(/[\s\-_,/()]+/)
    .filter(w => w.length > 3);

  if (keywords.length === 0) return [];

  return rows
    .map(card => {
      const text = `${card.front} ${card.back}`.toLowerCase();
      const score = keywords.filter(kw => text.includes(kw)).length;
      return { ...card, score };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Check questions ──────────────────────────────────────────────────────────

export function getTopicCheckQuestions(userId: string, topicId: string, chapterId?: string): TopicCheckQuestion[] {
  const rows = chapterId
    ? (db.prepare(
        'SELECT id, question, options, correct_index, explanation, depth, created_at FROM topic_check_questions WHERE user_id = ? AND topic_id = ? AND chapter_id = ? ORDER BY created_at ASC'
      ).all(userId, topicId, chapterId) as Array<{ id: string; question: string; options: string; correct_index: number; explanation: string; depth: number; created_at: string }>)
    : (db.prepare(
        'SELECT id, question, options, correct_index, explanation, depth, created_at FROM topic_check_questions WHERE user_id = ? AND topic_id = ? AND chapter_id IS NULL ORDER BY created_at ASC'
      ).all(userId, topicId) as Array<{ id: string; question: string; options: string; correct_index: number; explanation: string; depth: number; created_at: string }>);
  return rows.map(r => ({
    id: r.id,
    question: r.question,
    options: JSON.parse(r.options) as string[],
    correctIndex: r.correct_index,
    explanation: r.explanation,
    depth: r.depth,
    created_at: r.created_at,
  }));
}

export function saveTopicCheckQuestions(
  userId: string,
  topicId: string,
  courseId: string,
  sessionId: string,
  depth: number,
  questions: Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>,
  chapterId?: string,
): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO topic_check_questions
      (id, user_id, topic_id, course_id, session_id, chapter_id, question, options, correct_index, explanation, depth)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction((items: typeof questions) => {
    for (const q of items) {
      insert.run(randomUUID(), userId, topicId, courseId, sessionId,
        chapterId ?? null, q.question, JSON.stringify(q.options), q.correctIndex, q.explanation, depth);
    }
  })(questions);
}
