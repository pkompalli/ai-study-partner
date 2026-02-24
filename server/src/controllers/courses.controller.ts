import type { Request, Response, NextFunction } from 'express';
import { saveCourse, getCourseWithTree, listCourses, deleteCourse, updateCourse as updateCourseInDb, replaceStructure } from '../db/courses.db.js';
import { getTopicProgressForCourse, getChapterProgressForCourse } from '../db/sessions.db.js';
import {
  extractCourseFromText,
  extractCourseFromPDF,
  extractCourseFromImages,
  extractCourseFromJSON,
} from '../services/llm/courseExtractor.js';
import { uploadFile } from '../services/storage.js';

export async function extractCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { sourceType, rawInput } = req.body as { sourceType: string; rawInput?: string };

    // Support both single file upload (req.file) and multi-file (req.files)
    const fileFields = req.files as Record<string, Express.Multer.File[]> | undefined;
    const singleFile = req.file ?? fileFields?.['file']?.[0];
    const multiFiles = fileFields?.['files'] ?? (singleFile ? [singleFile] : []);

    console.log('[extractCourse] sourceType:', sourceType, '| rawInput length:', rawInput?.length ?? 0, '| files:', multiFiles.length || (singleFile ? 1 : 0));

    let structure;

    if (sourceType === 'text' && rawInput) {
      structure = await extractCourseFromText(rawInput);
    } else if (sourceType === 'pdf' && singleFile) {
      structure = await extractCourseFromPDF(singleFile.buffer);
    } else if (sourceType === 'image' && multiFiles.length > 0) {
      const images = multiFiles.map(f => ({ base64: f.buffer.toString('base64'), mimeType: f.mimetype }));
      structure = await extractCourseFromImages(images);
    } else if (sourceType === 'json' && (rawInput || singleFile)) {
      const jsonText = rawInput ?? singleFile!.buffer.toString('utf-8');
      structure = await extractCourseFromJSON(jsonText);
    } else {
      res.status(400).json({ error: 'Invalid source type or missing content' });
      return;
    }

    let sourceFileUrl: string | undefined;
    if (singleFile) {
      const filePath = `${userId}/${Date.now()}-${singleFile.originalname}`;
      sourceFileUrl = await uploadFile('course-uploads', filePath, singleFile.buffer, singleFile.mimetype);
    }

    console.log('[extractCourse] result subjects count:', (structure as { subjects?: unknown[] })?.subjects?.length ?? 0);
    res.json({ structure, sourceFileUrl });
  } catch (err) {
    next(err);
  }
}

export async function createCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { name, description, goal, examName, yearOfStudy, sourceType, sourceFileUrl, rawInput, structure } = req.body as {
      name: string; description?: string; goal: 'exam_prep' | 'classwork';
      examName?: string; yearOfStudy?: string; sourceType?: string;
      sourceFileUrl?: string; rawInput?: string; structure: { subjects: unknown[] };
    };

    const courseId = saveCourse(userId, {
      name, description, goal, examName, yearOfStudy, sourceType, sourceFileUrl, rawInput,
      structure: structure as Parameters<typeof saveCourse>[1]['structure'],
    });

    res.status(201).json({ id: courseId });
  } catch (err) {
    next(err);
  }
}

export async function getCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const courses = listCourses(req.user!.id);
    res.json(courses);
  } catch (err) {
    next(err);
  }
}

export async function getCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const course = getCourseWithTree(req.params['id'] as string, req.user!.id);
    res.json(course);
  } catch (err) {
    next(err);
  }
}

export async function updateCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateCourseInDb(req.params['id'] as string, req.user!.id, req.body as Record<string, unknown>);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function replaceStructureHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { subjects } = req.body as {
      subjects: Array<{ id?: string; name: string; topics: Array<{ id?: string; name: string }> }>;
    };
    replaceStructure(req.params['id'] as string, req.user!.id, subjects ?? []);
    const course = getCourseWithTree(req.params['id'] as string, req.user!.id);
    res.json(course);
  } catch (err) { next(err); }
}

export async function removeCourse(req: Request, res: Response, next: NextFunction) {
  try {
    deleteCourse(req.params['id'] as string, req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getCourseProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const courseId = req.params['id'] as string;
    const topicProgress = getTopicProgressForCourse(userId, courseId);
    const chapterProgress = getChapterProgressForCourse(userId, courseId);
    res.json({ topicProgress, chapterProgress });
  } catch (err) {
    next(err);
  }
}
