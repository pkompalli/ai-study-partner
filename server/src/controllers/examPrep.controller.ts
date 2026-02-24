import type { Request, Response, NextFunction } from 'express';
import {
  createExamFormat, getExamFormat, getExamFormatsForCourse, updateExamFormat, deleteExamFormat,
  saveExamQuestions, deleteExamQuestions, getExamQuestions,
  createAttempt, getAttempt, upsertAnswer, markAnswer as markAnswerDb,
  submitAttempt, getTopicReadinessForCourse,
} from '../db/examBank.db.js';
import { getCourseContext, getCourseWithTree } from '../db/courses.db.js';
import { inferExamFormat, generateExamQuestions } from '../services/llm/examQuestionGenerator.js';
import { markAnswer, getHint } from '../services/llm/examMarker.js';

// ─── Format CRUD ───────────────────────────────────────────────────────────────

export async function listFormats(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const courseId = req.query['courseId'] as string;
    if (!courseId) { res.status(400).json({ error: 'courseId required' }); return; }
    const formats = getExamFormatsForCourse(userId, courseId);
    res.json(formats);
  } catch (err) { next(err); }
}

export async function createFormat(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const payload = req.body as {
      courseId: string;
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
    };

    const formatId = createExamFormat(userId, payload.courseId, payload);
    const format = getExamFormat(formatId, userId);
    res.status(201).json(format);
  } catch (err) { next(err); }
}

export async function getFormat(req: Request, res: Response, next: NextFunction) {
  try {
    const format = getExamFormat(req.params['id'] as string, req.user!.id);
    if (!format) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(format);
  } catch (err) { next(err); }
}

export async function patchFormat(req: Request, res: Response, next: NextFunction) {
  try {
    updateExamFormat(req.params['id'] as string, req.user!.id, req.body as Record<string, unknown>);
    const format = getExamFormat(req.params['id'] as string, req.user!.id);
    res.json(format);
  } catch (err) { next(err); }
}

export async function removeFormat(req: Request, res: Response, next: NextFunction) {
  try {
    deleteExamFormat(req.params['id'] as string, req.user!.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── Format inference ──────────────────────────────────────────────────────────

export async function inferFormat(req: Request, res: Response, next: NextFunction) {
  try {
    const { courseId, examName } = req.body as { courseId: string; examName: string };
    if (!courseId || !examName) {
      res.status(400).json({ error: 'courseId and examName required' });
      return;
    }
    const ctx = getCourseContext(courseId);
    const inferred = await inferExamFormat(examName, ctx?.name ?? 'Course');
    res.json(inferred);
  } catch (err) { next(err); }
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function generateQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const formatId = req.params['id'] as string;

    const format = getExamFormat(formatId, userId);
    if (!format) { res.status(404).json({ error: 'Format not found' }); return; }

    const ctx = getCourseContext(format.course_id);
    const courseTree = getCourseWithTree(format.course_id, userId);

    // Flatten all topics with their subject names
    const topics: Array<{ id: string; name: string; subjectName?: string }> = [];
    for (const subject of (courseTree['subjects'] as Array<{ name: string; topics: Array<{ id: string; name: string }> }> ?? [])) {
      for (const topic of subject.topics ?? []) {
        topics.push({ id: topic.id, name: topic.name, subjectName: subject.name });
      }
    }

    if (topics.length === 0) {
      res.status(400).json({ error: 'Course has no topics' });
      return;
    }

    // Clear existing questions first
    deleteExamQuestions(formatId);

    // Generate new questions
    const generated = await generateExamQuestions({
      sections: format.sections,
      topics,
      courseName: ctx?.name ?? 'Course',
      examName: format.name,
      yearOfStudy: ctx?.yearOfStudy,
    });

    if (generated.length === 0) {
      res.status(500).json({ error: 'Failed to generate any questions' });
      return;
    }

    saveExamQuestions(formatId, format.course_id, generated);

    const questions = getExamQuestions(formatId);
    res.json({ count: questions.length, questions });
  } catch (err) { next(err); }
}

export async function listQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const formatId = req.params['id'] as string;
    const sectionId = req.query['sectionId'] as string | undefined;

    const format = getExamFormat(formatId, userId);
    if (!format) { res.status(404).json({ error: 'Format not found' }); return; }

    const questions = getExamQuestions(formatId, sectionId);
    res.json(questions);
  } catch (err) { next(err); }
}

export async function clearQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const formatId = req.params['id'] as string;
    const format = getExamFormat(formatId, userId);
    if (!format) { res.status(404).json({ error: 'Format not found' }); return; }
    deleteExamQuestions(formatId);
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── Attempts ─────────────────────────────────────────────────────────────────

export async function startAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { formatId, mode } = req.body as { formatId: string; mode: 'practice' | 'exam' };
    if (!formatId) { res.status(400).json({ error: 'formatId required' }); return; }

    const format = getExamFormat(formatId, userId);
    if (!format) { res.status(404).json({ error: 'Format not found' }); return; }

    const attemptId = createAttempt(userId, formatId, mode ?? 'practice');
    const questions = getExamQuestions(formatId);

    res.status(201).json({ attemptId, questions });
  } catch (err) { next(err); }
}

export async function getAttemptHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const attempt = getAttempt(req.params['id'] as string, req.user!.id);
    if (!attempt) { res.status(404).json({ error: 'Attempt not found' }); return; }
    res.json(attempt);
  } catch (err) { next(err); }
}

export async function submitAnswerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const attemptId = req.params['id'] as string;
    const { questionId, answerText, selectedOptionIndex, hintsUsed } = req.body as {
      questionId: string;
      answerText?: string;
      selectedOptionIndex?: number;
      hintsUsed?: number;
    };

    const attempt = getAttempt(attemptId, userId);
    if (!attempt) { res.status(404).json({ error: 'Attempt not found' }); return; }

    const questions = getExamQuestions(attempt.exam_format_id);
    const question = questions.find(q => q.id === questionId);
    if (!question) { res.status(404).json({ error: 'Question not found' }); return; }

    // Save the answer
    upsertAnswer(attemptId, questionId, answerText ?? null, hintsUsed ?? 0);

    // Mark immediately in practice mode (or if MCQ in any mode)
    const isMcq = question.section_question_type === 'mcq';
    const isPractice = attempt.mode === 'practice';

    if (isPractice || isMcq) {
      const result = await markAnswer({
        questionText: question.question_text,
        questionType: question.section_question_type,
        dataset: question.dataset,
        markScheme: question.mark_scheme,
        maxMarks: question.max_marks,
        studentAnswer: isMcq
          ? (question.options?.[selectedOptionIndex ?? -1] ?? answerText ?? '')
          : (answerText ?? ''),
        correctOptionIndex: question.correct_option_index,
        selectedOptionIndex,
      });

      markAnswerDb(attemptId, questionId, result.score, result.feedback);
      res.json({ score: result.score, maxMarks: question.max_marks, feedback: result.feedback });
    } else {
      res.json({ saved: true });
    }
  } catch (err) { next(err); }
}

export async function getHintHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const attemptId = req.params['id'] as string;
    const { questionId, answerText } = req.body as { questionId: string; answerText?: string };

    const attempt = getAttempt(attemptId, userId);
    if (!attempt) { res.status(404).json({ error: 'Attempt not found' }); return; }

    const questions = getExamQuestions(attempt.exam_format_id);
    const question = questions.find(q => q.id === questionId);
    if (!question) { res.status(404).json({ error: 'Question not found' }); return; }

    // Get current hints used for this question in this attempt
    const existingAnswer = attempt.answers.find(a => a.question_id === questionId);
    const hintsUsed = existingAnswer?.hints_used ?? 0;

    const hint = await getHint({
      questionText: question.question_text,
      questionType: question.section_question_type,
      dataset: question.dataset,
      studentAnswer: answerText,
      hintsUsed,
    });

    // Increment hints_used
    upsertAnswer(attemptId, questionId, answerText ?? existingAnswer?.answer_text ?? null, hintsUsed + 1);

    res.json({ hint, hintsUsed: hintsUsed + 1 });
  } catch (err) { next(err); }
}

export async function submitAttemptHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const attemptId = req.params['id'] as string;

    const attempt = getAttempt(attemptId, userId);
    if (!attempt) { res.status(404).json({ error: 'Attempt not found' }); return; }

    // For exam mode: mark all unmarked answers
    const questions = getExamQuestions(attempt.exam_format_id);
    const markingJobs = attempt.answers
      .filter(a => a.score === undefined || a.score === null)
      .map(async (a) => {
        const q = questions.find(q => q.id === a.question_id);
        if (!q) return;
        const result = await markAnswer({
          questionText: q.question_text,
          questionType: q.section_question_type,
          dataset: q.dataset,
          markScheme: q.mark_scheme,
          maxMarks: q.max_marks,
          studentAnswer: a.answer_text ?? '',
          correctOptionIndex: q.correct_option_index,
        });
        markAnswerDb(attemptId, a.question_id, result.score, result.feedback);
      });

    await Promise.allSettled(markingJobs);

    // Compute total score
    const updatedAttempt = getAttempt(attemptId, userId)!;
    const totalScore = updatedAttempt.answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const maxScore = questions.reduce((sum, q) => sum + q.max_marks, 0);

    submitAttempt(attemptId, totalScore, maxScore);

    res.json({ totalScore, maxScore });
  } catch (err) { next(err); }
}

// ─── Readiness ────────────────────────────────────────────────────────────────

export async function getReadiness(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const courseId = req.params['id'] as string;
    const readiness = getTopicReadinessForCourse(userId, courseId);
    res.json(readiness);
  } catch (err) { next(err); }
}
