import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { llmLimiter } from '../middleware/rateLimiter.js';
import {
  listFormats, createFormat, getFormat, patchFormat, removeFormat,
  inferFormat,
  generateQuestions, listQuestions, clearQuestions,
  startAttempt, getAttemptHandler, submitAnswerHandler, getHintHandler, submitAttemptHandler,
  getReadiness,
} from '../controllers/examPrep.controller.js';

const router = Router();

// Exam formats
router.get('/formats',             requireAuth, listFormats);
router.post('/formats',            requireAuth, createFormat);
router.post('/formats/infer',      requireAuth, llmLimiter, inferFormat);
router.get('/formats/:id',         requireAuth, getFormat);
router.patch('/formats/:id',       requireAuth, patchFormat);
router.delete('/formats/:id',      requireAuth, removeFormat);

// Questions
router.post('/formats/:id/questions',   requireAuth, llmLimiter, generateQuestions);
router.get('/formats/:id/questions',    requireAuth, listQuestions);
router.delete('/formats/:id/questions', requireAuth, clearQuestions);

// Attempts
router.post('/attempts',           requireAuth, startAttempt);
router.get('/attempts/:id',        requireAuth, getAttemptHandler);
router.post('/attempts/:id/answer', requireAuth, llmLimiter, submitAnswerHandler);
router.post('/attempts/:id/hint',   requireAuth, llmLimiter, getHintHandler);
router.post('/attempts/:id/submit', requireAuth, llmLimiter, submitAttemptHandler);

// Readiness (per course)
router.get('/readiness/:id',       requireAuth, getReadiness);

export default router;
