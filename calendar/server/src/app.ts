import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRouter from './routes/authRoutes';
import categoryRouter from './routes/categoryRoutes';
import workEntryRouter from './routes/workEntryRoutes';
import okrRouter from './routes/okrRoutes';
import { inspirationRouter, inspirationCategoryRouter } from './routes/inspirationRoutes';
import { summaryRouter } from './routes/summaryRoutes';
import { ValidationError, AuthError, ForbiddenError, NotFoundError } from './errors';

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true,
}));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/work-entries', workEntryRouter);
app.use('/api/okr', okrRouter);
app.use('/api/inspirations', inspirationRouter);
app.use('/api/inspiration-categories', inspirationCategoryRouter);
app.use('/api/summaries', summaryRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof AuthError) {
    return res.status(401).json({ error: err.message });
  }
  if (err instanceof ForbiddenError) {
    return res.status(403).json({ error: err.message });
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: '服务器内部错误' });
});

export default app;
