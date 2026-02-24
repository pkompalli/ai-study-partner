import { randomUUID } from 'crypto';
import { db } from '../config/database.js';
import type { CourseStructure } from '../types/index.js';

export function saveCourse(
  userId: string,
  payload: {
    name: string;
    description?: string;
    goal: 'exam_prep' | 'classwork';
    examName?: string;
    yearOfStudy?: string;
    sourceType?: string;
    sourceFileUrl?: string;
    rawInput?: string;
    structure: CourseStructure;
  }
): string {
  const courseId = randomUUID();

  db.prepare(`
    INSERT INTO courses (id, user_id, name, description, goal, exam_name, year_of_study, source_type, source_file_url, raw_input, structure)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    courseId,
    userId,
    payload.name,
    payload.description ?? null,
    payload.goal,
    payload.examName ?? null,
    payload.yearOfStudy ?? null,
    payload.sourceType ?? null,
    payload.sourceFileUrl ?? null,
    payload.rawInput ?? null,
    JSON.stringify(payload.structure)
  );

  for (let si = 0; si < payload.structure.subjects.length; si++) {
    const subject = payload.structure.subjects[si];
    const subjectId = randomUUID();
    db.prepare('INSERT INTO subjects (id, course_id, name, sort_order) VALUES (?, ?, ?, ?)').run(
      subjectId, courseId, subject.name, si
    );

    for (let ti = 0; ti < subject.topics.length; ti++) {
      const topic = subject.topics[ti];
      const topicId = randomUUID();
      db.prepare('INSERT INTO topics (id, subject_id, course_id, name, sort_order) VALUES (?, ?, ?, ?, ?)').run(
        topicId, subjectId, courseId, topic.name, ti
      );

      for (let ci = 0; ci < topic.chapters.length; ci++) {
        const chapter = topic.chapters[ci];
        db.prepare('INSERT INTO chapters (id, topic_id, course_id, name, sort_order) VALUES (?, ?, ?, ?, ?)').run(
          randomUUID(), topicId, courseId, chapter.name, ci
        );
      }
    }
  }

  return courseId;
}

export function getCourseWithTree(courseId: string, userId: string) {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND user_id = ?').get(courseId, userId) as Record<string, unknown> | undefined;
  if (!course) throw new Error('Course not found');

  course['structure'] = JSON.parse(course['structure'] as string);

  const subjects = db.prepare('SELECT * FROM subjects WHERE course_id = ? ORDER BY sort_order').all(courseId) as Record<string, unknown>[];
  course['subjects'] = subjects.map(subject => {
    const topics = db.prepare('SELECT * FROM topics WHERE subject_id = ? ORDER BY sort_order').all(subject['id'] as string) as Record<string, unknown>[];
    subject['topics'] = topics.map(topic => {
      const chapters = db.prepare('SELECT * FROM chapters WHERE topic_id = ? ORDER BY sort_order').all(topic['id'] as string);
      topic['chapters'] = chapters;
      return topic;
    });
    return subject;
  });

  return course;
}

export function listCourses(userId: string) {
  const courses = db.prepare(
    'SELECT id, name, description, goal, exam_name, year_of_study, is_active, created_at FROM courses WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as Record<string, unknown>[];

  return courses.map(course => {
    const subjects = db.prepare('SELECT * FROM subjects WHERE course_id = ? ORDER BY sort_order').all(course['id'] as string) as Record<string, unknown>[];
    course['subjects'] = subjects.map(subject => {
      const topics = db.prepare('SELECT * FROM topics WHERE subject_id = ? ORDER BY sort_order').all(subject['id'] as string) as Record<string, unknown>[];
      subject['topics'] = topics.map(topic => {
        const chapters = db.prepare('SELECT * FROM chapters WHERE topic_id = ? ORDER BY sort_order').all(topic['id'] as string);
        topic['chapters'] = chapters;
        return topic;
      });
      return subject;
    });
    return course;
  });
}

export function updateCourse(courseId: string, userId: string, fields: Record<string, unknown>) {
  const allowed = ['name', 'description', 'goal', 'is_active', 'exam_name', 'year_of_study'];
  const updates = Object.keys(fields).filter(k => allowed.includes(k));
  if (updates.length === 0) throw new Error('No valid fields to update');

  const setClauses = updates.map(k => `${k} = ?`).join(', ');
  const values = [...updates.map(k => fields[k]), courseId, userId];
  db.prepare(`UPDATE courses SET ${setClauses} WHERE id = ? AND user_id = ?`).run(...values);

  return db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
}

export function replaceStructure(
  courseId: string,
  userId: string,
  subjects: Array<{
    id?: string;
    name: string;
    topics: Array<{ id?: string; name: string }>;
  }>,
): void {
  const owns = db.prepare('SELECT id FROM courses WHERE id = ? AND user_id = ?').get(courseId, userId);
  if (!owns) throw new Error('Course not found');

  const existingSubjectIds = new Set(
    (db.prepare('SELECT id FROM subjects WHERE course_id = ?').all(courseId) as { id: string }[]).map(r => r.id)
  );
  const existingTopicIds = new Set(
    (db.prepare('SELECT id FROM topics WHERE course_id = ?').all(courseId) as { id: string }[]).map(r => r.id)
  );

  const keepSubjectIds = new Set<string>();
  const keepTopicIds = new Set<string>();

  db.transaction(() => {
    for (let si = 0; si < subjects.length; si++) {
      const subject = subjects[si];
      const subjectId = (subject.id && existingSubjectIds.has(subject.id)) ? subject.id : randomUUID();
      keepSubjectIds.add(subjectId);

      if (existingSubjectIds.has(subjectId)) {
        db.prepare('UPDATE subjects SET name = ?, sort_order = ? WHERE id = ?').run(subject.name, si, subjectId);
      } else {
        db.prepare('INSERT INTO subjects (id, course_id, name, sort_order) VALUES (?, ?, ?, ?)').run(subjectId, courseId, subject.name, si);
      }

      for (let ti = 0; ti < subject.topics.length; ti++) {
        const topic = subject.topics[ti];
        const topicId = (topic.id && existingTopicIds.has(topic.id)) ? topic.id : randomUUID();
        keepTopicIds.add(topicId);

        if (existingTopicIds.has(topicId)) {
          db.prepare('UPDATE topics SET name = ?, sort_order = ?, subject_id = ? WHERE id = ?').run(topic.name, ti, subjectId, topicId);
        } else {
          db.prepare('INSERT INTO topics (id, subject_id, course_id, name, sort_order) VALUES (?, ?, ?, ?, ?)').run(topicId, subjectId, courseId, topic.name, ti);
        }
      }
    }

    // Remove topics no longer in the list (for subjects we are keeping)
    for (const subjectId of existingSubjectIds) {
      if (!keepSubjectIds.has(subjectId)) continue;
      const topics = db.prepare('SELECT id FROM topics WHERE subject_id = ?').all(subjectId) as { id: string }[];
      for (const t of topics) {
        if (!keepTopicIds.has(t.id)) {
          db.prepare('DELETE FROM chapters WHERE topic_id = ?').run(t.id);
          db.prepare('DELETE FROM topics WHERE id = ?').run(t.id);
        }
      }
    }

    // Remove subjects (and their topics/chapters) no longer in the list
    for (const subjectId of existingSubjectIds) {
      if (!keepSubjectIds.has(subjectId)) {
        const topics = db.prepare('SELECT id FROM topics WHERE subject_id = ?').all(subjectId) as { id: string }[];
        for (const t of topics) {
          db.prepare('DELETE FROM chapters WHERE topic_id = ?').run(t.id);
          db.prepare('DELETE FROM topics WHERE id = ?').run(t.id);
        }
        db.prepare('DELETE FROM subjects WHERE id = ?').run(subjectId);
      }
    }
  })();
}

export function deleteCourse(courseId: string, userId: string): void {
  db.prepare('DELETE FROM courses WHERE id = ? AND user_id = ?').run(courseId, userId);
}

export function getTopicName(topicId: string): string | undefined {
  const row = db.prepare('SELECT name FROM topics WHERE id = ?').get(topicId) as { name: string } | undefined;
  return row?.name;
}

export function getChapterName(chapterId: string): string | undefined {
  const row = db.prepare('SELECT name FROM chapters WHERE id = ?').get(chapterId) as { name: string } | undefined;
  return row?.name;
}

export function getCourseName(courseId: string): string | undefined {
  const row = db.prepare('SELECT name FROM courses WHERE id = ?').get(courseId) as { name: string } | undefined;
  return row?.name;
}

export function getCourseGoal(courseId: string): string | undefined {
  const row = db.prepare('SELECT goal FROM courses WHERE id = ?').get(courseId) as { goal: string } | undefined;
  return row?.goal;
}

export interface CourseContext {
  name: string;
  goal: string;
  yearOfStudy?: string;
  examName?: string;
}

export function getCourseContext(courseId: string): CourseContext | undefined {
  const row = db.prepare(
    'SELECT name, goal, year_of_study, exam_name FROM courses WHERE id = ?'
  ).get(courseId) as { name: string; goal: string; year_of_study: string | null; exam_name: string | null } | undefined;
  if (!row) return undefined;
  return {
    name: row.name,
    goal: row.goal,
    yearOfStudy: row.year_of_study ?? undefined,
    examName: row.exam_name ?? undefined,
  };
}
