import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { llmLimiter } from '../middleware/rateLimiter.js';
import { getArtifactById, getArtifacts, exportPDF } from '../controllers/artifacts.controller.js';

const router = Router();

router.get('/', requireAuth, getArtifacts);
router.get('/:id', requireAuth, getArtifactById);
router.post('/:id/export/pdf', requireAuth, llmLimiter, exportPDF);

export default router;
