import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

// 导入路由
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import expressionRoutes from './routes/expressions';
import flashcardRoutes from './routes/flashcards';
import migrationRoutes from './routes/migration';
import { createNewsRouter } from './routes/news';
import { NewsStorageService } from './services/NewsStorageService';
import { SourceRegistryService } from './services/SourceRegistryService';
import { NewsScheduler } from './services/NewsScheduler';
import { NewsAggregator } from './services/NewsAggregator';
import { TopicMatcher } from './services/TopicMatcher';
import { NewsRanker } from './services/NewsRanker';

const app = express();

// 初始化新闻相关服务
const newsStorageService = new NewsStorageService();
const sourceRegistry = new SourceRegistryService();
const newsAggregator = new NewsAggregator(sourceRegistry);
const topicMatcher = new TopicMatcher();
const newsRanker = new NewsRanker(sourceRegistry);
const newsScheduler = new NewsScheduler(
  newsAggregator,
  topicMatcher,
  newsRanker,
  (dailyNews) => newsStorageService.saveDailyNews(dailyNews),
);

// 导出 scheduler 供 index.ts 使用
export { newsScheduler };

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
app.use('/api/news', createNewsRouter(newsStorageService, sourceRegistry, newsScheduler));

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
