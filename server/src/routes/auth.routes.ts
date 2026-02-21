import { Router } from 'express';
import { signUp, signIn, me } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.get('/me', requireAuth, me);

export default router;
