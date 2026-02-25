import { randomUUID } from 'crypto';
import { db } from '../config/database.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExamSection {
  id: string;
  exam_format_id: string;
  name: string;
  question_type: 'mcq' | 'short_answer' | 'long_answer' | 'data_analysis' | 'calculation';
  num_questions: number;
  marks_per_question?: number;
  total_marks?: number;
  instructions?: string;
  sort_order: number;
}

export interface ExamFormat {
  id: string;
  user_id: string;
  course_id: string;
  name: string;
  description?: string;
  total_marks?: number;
  time_minutes?: number;
  instructions?: string;
  created_at: string;
  sections: ExamSection[];
  question_count: number;
}

export interface ExamQuestion {
  id: string;
  exam_format_id: string;
  section_id: string;
  section_name: string;
  section_question_type: string;
  topic_id?: string;
  topic_name?: string;
  course_id: string;
  question_text: string;
  dataset?: string;
  options?: string[];
  correct_option_index?: number;
  max_marks: number;
  mark_scheme: MarkCriterion[];
  depth: number;
}

export interface MarkCriterion {
  label: string;
  description?: string;
  marks: number;
}

export interface ExamAttempt {
  id: string;
  user_id: string;
  exam_format_id: string;
  mode: 'practice' | 'exam';
  started_at: string;
  submitted_at?: string;
  total_score?: number;
  max_score?: number;
}

export interface AttemptAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_text?: string;
  hints_used: number;
  score?: number;
  feedback?: string;
  marked_at?: string;
}

// ─── Exam Formats ─────────────────────────────────────────────────────────────

export function createExamFormat(
  userId: string,
  courseId: string,
  payload: {
    name: string;
    description?: string;
    total_marks?: number;
    time_minutes?: number;
    instructions?: string;
    sections: Array<{
      name: string;
      question_type: string;
      num_questions: number;
      marks_per_question?: number;
      total_marks?: number;
      instructions?: string;
    }>;
  },
): string {
  const formatId = randomUUID();

  db.prepare(`
    INSERT INTO exam_formats (id, user_id, course_id, name, description, total_marks, time_minutes, instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    formatId, userId, courseId,
    payload.name,
    payload.description ?? null,
    payload.total_marks ?? null,
    payload.time_minutes ?? null,
    payload.instructions ?? null,
  );

  const insertSection = db.prepare(`
    INSERT INTO exam_sections (id, exam_format_id, name, question_type, num_questions, marks_per_question, total_marks, instructions, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction((sections: typeof payload.sections) => {
    sections.forEach((s, idx) => {
      insertSection.run(
        randomUUID(), formatId, s.name, s.question_type, s.num_questions,
        s.marks_per_question ?? null, s.total_marks ?? null, s.instructions ?? null, idx,
      );
    });
  })(payload.sections);

  return formatId;
}

export function getExamFormat(formatId: string, userId: string): ExamFormat | null {
  const row = db.prepare(`
    SELECT f.*, COUNT(q.id) AS question_count
    FROM exam_formats f
    LEFT JOIN exam_questions q ON f.id = q.exam_format_id
    WHERE f.id = ? AND f.user_id = ?
    GROUP BY f.id
  `).get(formatId, userId) as (Record<string, unknown> & { question_count: number }) | undefined;

  if (!row) return null;

  const sections = db.prepare(
    'SELECT * FROM exam_sections WHERE exam_format_id = ? ORDER BY sort_order'
  ).all(formatId) as ExamSection[];

  return {
    id: row['id'] as string,
    user_id: row['user_id'] as string,
    course_id: row['course_id'] as string,
    name: row['name'] as string,
    description: row['description'] as string | undefined,
    total_marks: row['total_marks'] as number | undefined,
    time_minutes: row['time_minutes'] as number | undefined,
    instructions: row['instructions'] as string | undefined,
    created_at: row['created_at'] as string,
    sections,
    question_count: row['question_count'] as number,
  };
}

export function getExamFormatsForCourse(userId: string, courseId: string): ExamFormat[] {
  const rows = db.prepare(`
    SELECT f.*, COUNT(q.id) AS question_count
    FROM exam_formats f
    LEFT JOIN exam_questions q ON f.id = q.exam_format_id
    WHERE f.user_id = ? AND f.course_id = ?
    GROUP BY f.id
    ORDER BY f.created_at DESC
  `).all(userId, courseId) as (Record<string, unknown> & { question_count: number })[];

  return rows.map(row => {
    const sections = db.prepare(
      'SELECT * FROM exam_sections WHERE exam_format_id = ? ORDER BY sort_order'
    ).all(row['id'] as string) as ExamSection[];

    return {
      id: row['id'] as string,
      user_id: row['user_id'] as string,
      course_id: row['course_id'] as string,
      name: row['name'] as string,
      description: row['description'] as string | undefined,
      total_marks: row['total_marks'] as number | undefined,
      time_minutes: row['time_minutes'] as number | undefined,
      instructions: row['instructions'] as string | undefined,
      created_at: row['created_at'] as string,
      sections,
      question_count: row['question_count'] as number,
    };
  });
}

export function updateExamFormat(
  formatId: string,
  userId: string,
  payload: {
    name?: string;
    description?: string;
    total_marks?: number;
    time_minutes?: number;
    instructions?: string;
  },
): void {
  const allowed = ['name', 'description', 'total_marks', 'time_minutes', 'instructions'] as const;
  const updates = (Object.keys(payload) as (keyof typeof payload)[]).filter(k => allowed.includes(k as typeof allowed[number]));
  if (updates.length === 0) return;

  const setClauses = updates.map(k => `${k} = ?`).join(', ');
  const values = [...updates.map(k => payload[k] ?? null), formatId, userId];
  db.prepare(`UPDATE exam_formats SET ${setClauses} WHERE id = ? AND user_id = ?`).run(...values);
}

export function replaceSections(
  formatId: string,
  userId: string,
  sections: Array<{
    name: string;
    question_type: string;
    num_questions: number;
    marks_per_question?: number;
    total_marks?: number;
    instructions?: string;
  }>,
): void {
  const owns = db.prepare('SELECT id FROM exam_formats WHERE id = ? AND user_id = ?').get(formatId, userId);
  if (!owns) throw new Error('Format not found');

  const insert = db.prepare(`
    INSERT INTO exam_sections (id, exam_format_id, name, question_type, num_questions, marks_per_question, total_marks, instructions, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    db.prepare('DELETE FROM exam_sections WHERE exam_format_id = ?').run(formatId);
    sections.forEach((s, idx) => {
      insert.run(
        randomUUID(), formatId, s.name, s.question_type, s.num_questions,
        s.marks_per_question ?? null, s.total_marks ?? null, s.instructions ?? null, idx,
      );
    });
  })();
}

export function deleteExamFormat(formatId: string, userId: string): void {
  db.prepare('DELETE FROM exam_formats WHERE id = ? AND user_id = ?').run(formatId, userId);
}

// ─── Questions ────────────────────────────────────────────────────────────────

export function saveExamQuestions(
  formatId: string,
  courseId: string,
  questions: Array<{
    id?: string;           // use this UUID when provided (pre-assigned by caller)
    section_id: string;
    topic_id?: string;
    question_text: string;
    dataset?: string;
    options?: string[];
    correct_option_index?: number;
    max_marks: number;
    mark_scheme: MarkCriterion[];
    depth?: number;
  }>,
): void {
  const insert = db.prepare(`
    INSERT INTO exam_questions
      (id, exam_format_id, section_id, topic_id, course_id, question_text, dataset, options, correct_option_index, max_marks, mark_scheme, depth)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction((qs: typeof questions) => {
    for (const q of qs) {
      insert.run(
        q.id ?? randomUUID(), formatId, q.section_id,
        q.topic_id ?? null, courseId,
        q.question_text,
        q.dataset ?? null,
        q.options ? JSON.stringify(q.options) : null,
        q.correct_option_index ?? null,
        q.max_marks,
        JSON.stringify(q.mark_scheme),
        q.depth ?? 3,
      );
    }
  })(questions);
}

export function deleteExamQuestions(formatId: string): void {
  db.prepare('DELETE FROM exam_questions WHERE exam_format_id = ?').run(formatId);
}

export function getExamQuestionById(questionId: string): ExamQuestion | null {
  const r = db.prepare(`
    SELECT q.id, q.exam_format_id, q.section_id, q.topic_id, q.course_id,
           q.question_text, q.dataset, q.options, q.correct_option_index,
           q.max_marks, q.mark_scheme, q.depth,
           s.name AS section_name, s.question_type AS section_question_type,
           t.name AS topic_name
    FROM exam_questions q
    JOIN exam_sections s ON q.section_id = s.id
    LEFT JOIN topics t ON q.topic_id = t.id
    WHERE q.id = ?
  `).get(questionId) as Record<string, unknown> | undefined;

  if (!r) return null;
  return {
    id: r['id'] as string,
    exam_format_id: r['exam_format_id'] as string,
    section_id: r['section_id'] as string,
    section_name: r['section_name'] as string,
    section_question_type: r['section_question_type'] as string,
    topic_id: r['topic_id'] as string | undefined,
    topic_name: r['topic_name'] as string | undefined,
    course_id: r['course_id'] as string,
    question_text: r['question_text'] as string,
    dataset: r['dataset'] as string | undefined,
    options: r['options'] ? JSON.parse(r['options'] as string) as string[] : undefined,
    correct_option_index: r['correct_option_index'] as number | undefined,
    max_marks: r['max_marks'] as number,
    mark_scheme: JSON.parse(r['mark_scheme'] as string) as MarkCriterion[],
    depth: r['depth'] as number,
  };
}

export function getExamQuestions(formatId: string, sectionId?: string): ExamQuestion[] {
  const whereClause = sectionId
    ? 'WHERE q.exam_format_id = ? AND q.section_id = ?'
    : 'WHERE q.exam_format_id = ?';
  const params = sectionId ? [formatId, sectionId] : [formatId];

  const rows = db.prepare(`
    SELECT q.id, q.exam_format_id, q.section_id, q.topic_id, q.course_id,
           q.question_text, q.dataset, q.options, q.correct_option_index,
           q.max_marks, q.mark_scheme, q.depth,
           s.name AS section_name, s.question_type AS section_question_type,
           t.name AS topic_name
    FROM exam_questions q
    JOIN exam_sections s ON q.section_id = s.id
    LEFT JOIN topics t ON q.topic_id = t.id
    ${whereClause}
    ORDER BY s.sort_order, q.created_at
  `).all(...params) as Array<Record<string, unknown>>;

  return rows.map(r => ({
    id: r['id'] as string,
    exam_format_id: r['exam_format_id'] as string,
    section_id: r['section_id'] as string,
    section_name: r['section_name'] as string,
    section_question_type: r['section_question_type'] as string,
    topic_id: r['topic_id'] as string | undefined,
    topic_name: r['topic_name'] as string | undefined,
    course_id: r['course_id'] as string,
    question_text: r['question_text'] as string,
    dataset: r['dataset'] as string | undefined,
    options: r['options'] ? JSON.parse(r['options'] as string) as string[] : undefined,
    correct_option_index: r['correct_option_index'] as number | undefined,
    max_marks: r['max_marks'] as number,
    mark_scheme: JSON.parse(r['mark_scheme'] as string) as MarkCriterion[],
    depth: r['depth'] as number,
  }));
}

// ─── Attempts ─────────────────────────────────────────────────────────────────

export function createAttempt(userId: string, formatId: string, mode: 'practice' | 'exam'): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO exam_attempts (id, user_id, exam_format_id, mode)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, formatId, mode);
  return id;
}

export function getAttempt(attemptId: string, userId: string): (ExamAttempt & { answers: AttemptAnswer[] }) | null {
  const attempt = db.prepare(
    'SELECT * FROM exam_attempts WHERE id = ? AND user_id = ?'
  ).get(attemptId, userId) as Record<string, unknown> | undefined;

  if (!attempt) return null;

  const answers = db.prepare(
    'SELECT * FROM exam_attempt_answers WHERE attempt_id = ?'
  ).all(attemptId) as AttemptAnswer[];

  return {
    id: attempt['id'] as string,
    user_id: attempt['user_id'] as string,
    exam_format_id: attempt['exam_format_id'] as string,
    mode: attempt['mode'] as 'practice' | 'exam',
    started_at: attempt['started_at'] as string,
    submitted_at: attempt['submitted_at'] as string | undefined,
    total_score: attempt['total_score'] as number | undefined,
    max_score: attempt['max_score'] as number | undefined,
    answers,
  };
}

export function upsertAnswer(
  attemptId: string,
  questionId: string,
  answerText: string | null,
  hintsUsed: number,
): void {
  db.prepare(`
    INSERT INTO exam_attempt_answers (id, attempt_id, question_id, answer_text, hints_used)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(attempt_id, question_id)
    DO UPDATE SET answer_text = excluded.answer_text, hints_used = excluded.hints_used
  `).run(randomUUID(), attemptId, questionId, answerText, hintsUsed);
}

export function markAnswer(
  attemptId: string,
  questionId: string,
  score: number,
  feedback: string,
): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE exam_attempt_answers
    SET score = ?, feedback = ?, marked_at = ?
    WHERE attempt_id = ? AND question_id = ?
  `).run(score, feedback, now, attemptId, questionId);
}

export function submitAttempt(attemptId: string, totalScore: number, maxScore: number): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE exam_attempts
    SET submitted_at = ?, total_score = ?, max_score = ?
    WHERE id = ?
  `).run(now, totalScore, maxScore, attemptId);
}

export function getLatestAttemptForFormat(userId: string, formatId: string): ExamAttempt | null {
  const row = db.prepare(`
    SELECT * FROM exam_attempts
    WHERE user_id = ? AND exam_format_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, formatId) as Record<string, unknown> | undefined;

  if (!row) return null;
  return {
    id: row['id'] as string,
    user_id: row['user_id'] as string,
    exam_format_id: row['exam_format_id'] as string,
    mode: row['mode'] as 'practice' | 'exam',
    started_at: row['started_at'] as string,
    submitted_at: row['submitted_at'] as string | undefined,
    total_score: row['total_score'] as number | undefined,
    max_score: row['max_score'] as number | undefined,
  };
}

// ─── Readiness (computed from attempt answers) ────────────────────────────────

export interface TopicReadiness {
  topic_id: string;
  topic_name: string;
  questions_attempted: number;
  questions_correct: number;
  readiness_score: number;
}

export function getTopicReadinessForCourse(userId: string, courseId: string): TopicReadiness[] {
  const rows = db.prepare(`
    SELECT
      q.topic_id,
      t.name AS topic_name,
      COUNT(DISTINCT a.id) AS questions_attempted,
      SUM(CASE WHEN a.score >= q.max_marks * 0.5 THEN 1 ELSE 0 END) AS questions_correct
    FROM exam_attempt_answers a
    JOIN exam_questions q ON a.question_id = q.id
    JOIN topics t ON q.topic_id = t.id
    JOIN exam_attempts att ON a.attempt_id = att.id
    WHERE att.user_id = ? AND q.course_id = ?
      AND a.marked_at IS NOT NULL AND q.topic_id IS NOT NULL
    GROUP BY q.topic_id
  `).all(userId, courseId) as Array<{
    topic_id: string; topic_name: string;
    questions_attempted: number; questions_correct: number;
  }>;

  return rows.map(r => ({
    topic_id: r.topic_id,
    topic_name: r.topic_name,
    questions_attempted: r.questions_attempted,
    questions_correct: r.questions_correct,
    readiness_score: r.questions_attempted > 0
      ? Math.round((r.questions_correct / r.questions_attempted) * 100)
      : 0,
  }));
}

// ─── User settings ────────────────────────────────────────────────────────────

export function getUserScoringRubric(userId: string): string {
  const row = db.prepare('SELECT scoring_rubric FROM users WHERE id = ?').get(userId) as { scoring_rubric: string | null } | undefined;
  return row?.scoring_rubric ?? '';
}

export function setUserScoringRubric(userId: string, rubric: string): void {
  db.prepare('UPDATE users SET scoring_rubric = ? WHERE id = ?').run(rubric || null, userId);
}
