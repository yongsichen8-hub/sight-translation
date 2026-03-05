import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config, validateConfig } from './config/index';
import { TrackerService } from './services/TrackerService';
import { BitableService } from './services/BitableService';
import { AuthService } from './services/AuthService';
import { createAuthMiddleware } from './middleware/authMiddleware';
import { createAuthRouter } from './routes/auth';
import { createProjectsRouter } from './routes/projects';
import { createTimeRecordsRouter } from './routes/timeRecords';
import { createStatsRouter } from './routes/stats';

// Validate environment variables
validateConfig();

const app = express();

// Middleware
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Initialize services
const trackerService = new TrackerService();
const bitableService = new BitableService(
  config.FEISHU_APP_ID,
  config.FEISHU_APP_SECRET,
  {
    appToken: config.BITABLE_APP_TOKEN,
    interpretationTableId: config.INTERPRETATION_TABLE_ID,
    translationTableId: config.TRANSLATION_TABLE_ID,
    statusFieldName: '承接进度',
    workhourFieldName: '工时统计/min',
  }
);
const authService = new AuthService(trackerService);
const authMiddleware = createAuthMiddleware(authService);

// Register routes
app.use('/api/auth', createAuthRouter(authService, authMiddleware));
app.use('/api/projects', authMiddleware, createProjectsRouter(bitableService));
app.use('/api/time-records', authMiddleware, createTimeRecordsRouter(trackerService, bitableService));
app.use('/api/stats', authMiddleware, createStatsRouter(trackerService));

// Global error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] ${err.message}`);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
  });
});

const PORT = parseInt(config.PORT, 10);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
