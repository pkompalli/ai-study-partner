import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { llmLimiter } from '../middleware/rateLimiter.js';
import {
  startSession, getSessionById, getSessions, sendMessage,
  requestQuiz, requestFlashcards, requestVideos, endSessionHandler,
  getSessionSummary, getResponsePills, regenerateMessage,
  getTopicBankCards, getTopicBankQuestions, reviewCard,
  getCrossTopicCardsHandler, saveCardFromQuestion,
} from '../controllers/sessions.controller.js';

const router = Router();

router.post('/', requireAuth, startSession);
router.get('/', requireAuth, getSessions);
router.get('/:id', requireAuth, getSessionById);
router.post('/:id/messages', requireAuth, llmLimiter, sendMessage);
router.post('/:id/quiz', requireAuth, llmLimiter, requestQuiz);
router.post('/:id/flashcards', requireAuth, llmLimiter, requestFlashcards);
router.post('/:id/videos', requireAuth, llmLimiter, requestVideos);
router.patch('/:id/end', requireAuth, llmLimiter, endSessionHandler);
router.get('/:id/summary', requireAuth, llmLimiter, getSessionSummary);
router.get('/:id/pills', requireAuth, llmLimiter, getResponsePills);
router.post('/:id/regenerate', requireAuth, llmLimiter, regenerateMessage);
router.get('/:id/topic-cards', requireAuth, getTopicBankCards);
router.get('/:id/topic-questions', requireAuth, getTopicBankQuestions);
router.patch('/:id/card-review', requireAuth, reviewCard);
router.post('/:id/save-card', requireAuth, saveCardFromQuestion);
router.get('/:id/cross-topic-cards', requireAuth, getCrossTopicCardsHandler);

export default router;
