import type { Request, Response, NextFunction } from 'express';
import {
  createSession, getSession, getSessionMessages, saveMessage,
  endSession, listSessions, saveQuiz, submitQuizAnswers, saveFlashcardSet,
  upsertTopicProgress,
} from '../db/sessions.db.js';
import { saveArtifact } from '../db/artifacts.db.js';
import { getTopicName, getChapterName, getCourseContext } from '../db/courses.db.js';
import { streamTutorResponse } from '../services/llm/tutor.js';
import { generateQuiz } from '../services/llm/quizGenerator.js';
import { generateFlashcards } from '../services/llm/flashcardGenerator.js';
import { compileArtifact } from '../services/llm/artifactCompiler.js';
import { fetchVideoLinks } from '../services/youtube.js';
import { streamTopicSummarySSE } from '../services/llm/summaryGenerator.js';
import { generateResponsePills } from '../services/llm/pillsGenerator.js';
import {
  getTopicCards, getTopicCardFronts, saveTopicCards,
  getTopicCheckQuestions,
  reviewTopicCard, getCrossTopicCards,
} from '../db/topicBank.db.js';
import { inferAcademicLevel } from '../services/llm/prompts.js';

export async function startSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { courseId, topicId, chapterId } = req.body as { courseId: string; topicId?: string; chapterId?: string };
    const sessionId = createSession(userId, courseId, topicId, chapterId);
    res.status(201).json({ id: sessionId });
  } catch (err) {
    next(err);
  }
}

export async function getSessionById(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.params['id'] as string;
    const session = getSession(sessionId, req.user!.id);
    const messages = getSessionMessages(sessionId);
    res.json({ ...session, messages });
  } catch (err) {
    next(err);
  }
}

export async function getSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const sessions = listSessions(req.user!.id, req.query['courseId'] as string | undefined);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;
    const { content, depth } = req.body as { content: string; depth?: number };

    const session = getSession(sessionId, userId);
    const courseCtx = getCourseContext(session['course_id'] as string);

    let topicName = 'General';
    let chapterName: string | undefined;

    if (session['topic_id']) {
      topicName = getTopicName(session['topic_id'] as string) ?? 'General';
    }
    if (session['chapter_id']) {
      chapterName = getChapterName(session['chapter_id'] as string);
    }

    saveMessage(sessionId, 'user', content);
    const history = getSessionMessages(sessionId);

    const assistantContent = await streamTutorResponse(res, content, history, {
      courseName: courseCtx?.name ?? 'Course',
      topicName,
      chapterName,
      goal: courseCtx?.goal,
      yearOfStudy: courseCtx?.yearOfStudy,
      examName: courseCtx?.examName,
      depth,
    });

    // Save BEFORE signalling done so fetchPills always finds the message
    saveMessage(sessionId, 'assistant', assistantContent);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    next(err);
  }
}

export async function requestQuiz(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;

    const session = getSession(sessionId, userId);
    const messages = getSessionMessages(sessionId);

    let topicName = 'General';
    if (session['topic_id']) {
      topicName = getTopicName(session['topic_id'] as string) ?? 'General';
    }

    const questions = await generateQuiz(topicName, messages);
    const quizId = saveQuiz(sessionId, userId, session['topic_id'] as string | undefined, questions);
    saveMessage(sessionId, 'assistant', 'Here is your quiz!', 'quiz', { quizId, questions });

    res.json({ id: quizId, questions });
  } catch (err) {
    next(err);
  }
}

export async function requestFlashcards(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;
    const depth = parseInt((req.query['depth'] as string) ?? '0', 10) || 0;

    const session = getSession(sessionId, userId);
    const messages = getSessionMessages(sessionId);
    const topicId = session['topic_id'] as string | undefined;
    const courseId = session['course_id'] as string;

    let topicName = 'General';
    if (topicId) {
      topicName = getTopicName(topicId) ?? 'General';
    }

    // Load existing card fronts so the LLM generates only new concepts
    const existingFronts = topicId ? getTopicCardFronts(userId, topicId) : [];
    const newCards = await generateFlashcards(topicName, messages, existingFronts);

    // Persist new cards to the topic bank (INSERT OR IGNORE deduplicates)
    if (topicId && newCards.length > 0) {
      saveTopicCards(userId, topicId, courseId, sessionId, depth, newCards);
    }

    // Also save to the session-scoped flashcard_sets for backwards compat
    const setId = saveFlashcardSet(sessionId, userId, topicId, newCards);
    if (!req.query['silent']) {
      saveMessage(sessionId, 'assistant', 'Here are your flashcards!', 'flashcards', { setId, cards: newCards });
    }

    // Return the full topic bank (existing + new) so the client always shows the complete deck
    const allCards = topicId
      ? getTopicCards(userId, topicId)
      : newCards;

    res.json({ id: setId, cards: allCards });
  } catch (err) {
    next(err);
  }
}

export async function requestVideos(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;

    const session = getSession(sessionId, userId);

    let topicName = 'General';
    let chapterName: string | undefined;

    if (session['topic_id']) {
      topicName = getTopicName(session['topic_id'] as string) ?? 'General';
    }
    if (session['chapter_id']) {
      chapterName = getChapterName(session['chapter_id'] as string);
    }

    const videos = await fetchVideoLinks(topicName, chapterName);
    saveMessage(sessionId, 'assistant', 'Here are some helpful videos!', 'videos', { videos });

    res.json({ videos });
  } catch (err) {
    next(err);
  }
}

export async function getSessionSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;
    const depth = parseInt((req.query['depth'] as string) ?? '0', 10) || 0;

    const session = getSession(sessionId, userId);
    const courseCtx = getCourseContext(session['course_id'] as string);

    let topicName = 'General';
    let chapterName: string | undefined;

    if (session['topic_id']) {
      topicName = getTopicName(session['topic_id'] as string) ?? 'General';
    }
    if (session['chapter_id']) {
      chapterName = getChapterName(session['chapter_id'] as string);
    }

    await streamTopicSummarySSE(res, {
      courseName: courseCtx?.name ?? 'Course',
      topicName,
      chapterName,
      yearOfStudy: courseCtx?.yearOfStudy,
      examName: courseCtx?.examName,
      goal: courseCtx?.goal,
      depth,
    });
  } catch (err) {
    next(err);
  }
}

export async function getResponsePills(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;

    const session = getSession(sessionId, userId);
    const courseCtx = getCourseContext(session['course_id'] as string);
    const messages = getSessionMessages(sessionId);

    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content_type !== 'quiz' && m.content_type !== 'flashcards' && m.content_type !== 'videos');
    if (!lastAssistant) {
      res.json({ questions: [], followupPills: [] });
      return;
    }

    let topicName = 'General';
    if (session['topic_id']) {
      topicName = getTopicName(session['topic_id'] as string) ?? 'General';
    }

    const level = inferAcademicLevel(courseCtx?.yearOfStudy, courseCtx?.name);
    const result = await generateResponsePills(lastAssistant.content, topicName, level.label);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function regenerateMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;
    const { messageIndex, depth } = req.body as { messageIndex: number; depth: number };

    const session = getSession(sessionId, userId);
    const courseCtx = getCourseContext(session['course_id'] as string);

    let topicName = 'General';
    let chapterName: string | undefined;

    if (session['topic_id']) {
      topicName = getTopicName(session['topic_id'] as string) ?? 'General';
    }
    if (session['chapter_id']) {
      chapterName = getChapterName(session['chapter_id'] as string);
    }

    const allMessages = getSessionMessages(sessionId);
    const visibleMessages = allMessages.filter(m => m.role !== 'system');

    if (messageIndex < 1 || messageIndex >= visibleMessages.length) {
      res.status(400).json({ error: 'Invalid messageIndex' });
      return;
    }

    const userMsg = visibleMessages[messageIndex - 1];
    if (!userMsg || userMsg.role !== 'user') {
      res.status(400).json({ error: 'No preceding user message found' });
      return;
    }

    const historyBeforeUser = visibleMessages.slice(0, messageIndex - 1);

    await streamTutorResponse(res, userMsg.content, historyBeforeUser, {
      courseName: courseCtx?.name ?? 'Course',
      topicName,
      chapterName,
      goal: courseCtx?.goal,
      yearOfStudy: courseCtx?.yearOfStudy,
      examName: courseCtx?.examName,
      depth,
    });

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    next(err);
  }
}

export async function reviewCard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { cardId, correct } = req.body as { cardId: string; correct: boolean };

    const result = reviewTopicCard(userId, cardId, correct);
    if (!result) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCrossTopicCardsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;
    const session = getSession(sessionId, userId);
    const topicId = session['topic_id'] as string | undefined;
    const courseId = session['course_id'] as string;

    if (!topicId) {
      res.json({ cards: [] });
      return;
    }

    const topicName = getTopicName(topicId) ?? '';
    const cards = getCrossTopicCards(userId, courseId, topicId, topicName);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
}

export async function getTopicBankCards(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;
    const session = getSession(sessionId, userId);
    const topicId = session['topic_id'] as string | undefined;

    if (!topicId) {
      res.json({ cards: [] });
      return;
    }
    const cards = getTopicCards(userId, topicId);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
}

export async function getTopicBankQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;
    const session = getSession(sessionId, userId);
    const topicId = session['topic_id'] as string | undefined;

    if (!topicId) {
      res.json({ questions: [] });
      return;
    }
    const questions = getTopicCheckQuestions(userId, topicId);
    res.json({ questions });
  } catch (err) {
    next(err);
  }
}

export async function endSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const sessionId = req.params['id'] as string;

    const session = getSession(sessionId, userId);
    const messages = getSessionMessages(sessionId);

    const courseName = getCourseContext(session['course_id'] as string)?.name ?? 'Course';

    let topicName = 'General';
    let chapterName: string | undefined;

    if (session['topic_id']) {
      topicName = getTopicName(session['topic_id'] as string) ?? 'General';
    }
    if (session['chapter_id']) {
      chapterName = getChapterName(session['chapter_id'] as string);
    }

    const markdownContent = await compileArtifact({
      courseName,
      topicName,
      chapterName,
      messages,
    });

    const title = `${topicName}${chapterName ? ` — ${chapterName}` : ''} — Study Session`;

    const artifactId = saveArtifact(
      sessionId, userId, session['course_id'] as string, session['topic_id'] as string | undefined, title, markdownContent
    );

    endSession(sessionId, userId);

    if (session['topic_id']) {
      upsertTopicProgress(userId, session['topic_id'] as string, session['course_id'] as string, 'completed');
    }

    res.json({ artifactId });
  } catch (err) {
    next(err);
  }
}
