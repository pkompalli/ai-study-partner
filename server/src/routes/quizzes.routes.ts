import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getQuiz, submitQuizAnswers } from '../db/sessions.db.js';
import { scoreQuiz } from '../services/llm/quizGenerator.js';
import type { QuizQuestion } from '../types/index.js';

const router = Router();

router.post('/:id/submit', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quizId = req.params['id'] as string;
    const { answers } = req.body as { answers: Record<string, number> };

    const quiz = getQuiz(quizId, req.user!.id);

    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found' });
      return;
    }

    const { score, total, results } = scoreQuiz(quiz['questions'] as QuizQuestion[], answers);
    submitQuizAnswers(quizId, req.user!.id, answers, score, total);

    res.json({ score, total, results });
  } catch (err) {
    next(err);
  }
});

export default router;
