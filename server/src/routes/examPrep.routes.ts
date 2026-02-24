import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { llmLimiter } from '../middleware/rateLimiter.js';
import {
  listFormats, createFormat, getFormat, patchFormat, putFormat, removeFormat,
  inferFormat,
  generateQuestions, listQuestions, clearQuestions,
  generateBatchHandler, markStandaloneHandler, getHintStandaloneHandler,
  startAttempt, getAttemptHandler, submitAnswerHandler, getHintHandler, submitAttemptHandler,
  getReadiness,
  extractPaperHandler, importExtractedHandler,
} from '../controllers/examPrep.controller.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();

// Exam formats
router.get('/formats',                    requireAuth, listFormats);
router.post('/formats',                   requireAuth, createFormat);
router.post('/formats/infer',             requireAuth, llmLimiter, inferFormat);
router.post('/formats/extract-paper',     requireAuth, llmLimiter, upload.array('files', 30), extractPaperHandler);
router.post('/formats/import-questions',  requireAuth, importExtractedHandler);
router.get('/formats/:id',                requireAuth, getFormat);
router.patch('/formats/:id',              requireAuth, patchFormat);
router.put('/formats/:id',                requireAuth, putFormat);
router.delete('/formats/:id',             requireAuth, removeFormat);

// Questions
router.post('/formats/:id/questions',        requireAuth, llmLimiter, generateQuestions);
router.post('/formats/:id/questions/batch',  requireAuth, llmLimiter, generateBatchHandler);
router.get('/formats/:id/questions',         requireAuth, listQuestions);
router.delete('/formats/:id/questions',      requireAuth, clearQuestions);

// Standalone marking + hints (session practice tab — no attempt required)
router.post('/mark', requireAuth, llmLimiter, upload.array('files', 10), markStandaloneHandler);
router.post('/hint', requireAuth, llmLimiter, getHintStandaloneHandler);

// Attempts
router.post('/attempts',           requireAuth, startAttempt);
router.get('/attempts/:id',        requireAuth, getAttemptHandler);
router.post('/attempts/:id/answer', requireAuth, llmLimiter, submitAnswerHandler);
router.post('/attempts/:id/hint',   requireAuth, llmLimiter, getHintHandler);
router.post('/attempts/:id/submit', requireAuth, llmLimiter, submitAttemptHandler);

// Readiness (per course)
router.get('/readiness/:id',       requireAuth, getReadiness);

export default router;
