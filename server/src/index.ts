import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import './config/database.js'; // initialize DB and run migrations
import { defaultLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.routes.js';
import authRouter from './routes/auth.routes.js';
import coursesRouter from './routes/courses.routes.js';
import sessionsRouter from './routes/sessions.routes.js';
import artifactsRouter from './routes/artifacts.routes.js';
import quizzesRouter from './routes/quizzes.routes.js';
import examPrepRouter from './routes/examPrep.routes.js';

// Ensure uploads dir exists
const uploadsDir = path.resolve(env.UPLOADS_DIR);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(defaultLimiter);

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/artifacts', artifactsRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/exam', examPrepRouter);

app.use(errorHandler);

const server = app.listen(parseInt(env.PORT), () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
});

// Graceful shutdown so tsx watch can restart without EADDRINUSE
process.on('SIGTERM', () => server.close());
process.on('SIGINT',  () => server.close());
