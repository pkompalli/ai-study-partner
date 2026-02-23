import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { llmLimiter } from '../middleware/rateLimiter.js';
import {
  extractCourse, createCourse, getCourses, getCourse, updateCourse, removeCourse, getCourseProgress,
} from '../controllers/courses.controller.js';

const router = Router();

router.post('/extract', requireAuth, llmLimiter, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'files', maxCount: 20 }]), extractCourse);
router.post('/', requireAuth, createCourse);
router.get('/', requireAuth, getCourses);
router.get('/:id/progress', requireAuth, getCourseProgress);
router.get('/:id', requireAuth, getCourse);
router.patch('/:id', requireAuth, updateCourse);
router.delete('/:id', requireAuth, removeCourse);

export default router;
