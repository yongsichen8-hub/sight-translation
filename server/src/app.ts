import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

// 导入路由
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import expressionRoutes from './routes/expressions';
import flashcardRoutes from './routes/flashcards';
import migrationRoutes from './routes/migration';
import { createStudySessionsRouter } from './routes/studySessions';
import { createTermsRouter } from './routes/terms';
import { createNotebookRoutes } from './routes/notebooks';
import { ContentExtractor } from './services/ContentExtractor';
import { StudySessionService } from './services/StudySessionService';
import { TermService } from './services/TermService';
import { NotebookService } from './services/NotebookService';
import { fileStorageService } from './services/FileStorageService';

const app = express();

// 初始化服务
const contentExtractor = new ContentExtractor();
const studySessionService = new StudySessionService(fileStorageService);
const termService = new TermService(fileStorageService);
const notebookService = new NotebookService(fileStorageService);

// 基础中间件
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// CORS 配置
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
}));

// 请求频率限制
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '请求过于频繁，请稍后再试',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/expressions', expressionRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/study-sessions', createStudySessionsRouter(studySessionService, contentExtractor));
app.use('/api/terms', createTermsRouter(termService));
app.use('/api/notebooks', createNotebookRoutes(notebookService));

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在',
    },
  });
});

// 错误处理中间件
app.use(errorHandler);

export default app;
