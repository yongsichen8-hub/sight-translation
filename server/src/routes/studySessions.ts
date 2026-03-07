import { Router, Request, Response } from 'express';
import { StudySessionService } from '../services/StudySessionService';
import { ContentExtractor, ContentExtractorError } from '../services/ContentExtractor';
import { CreateSessionInput } from '../types/briefing';

const DEFAULT_USER_ID = 'default-user';

export function createStudySessionsRouter(
  sessionService: StudySessionService,
  contentExtractor: ContentExtractor,
): Router {
  const router = Router();

  /**
   * POST /api/study-sessions
   * 创建研习会话
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      const input: CreateSessionInput = req.body;

      if (!input.newsEntryId || !input.chineseTitle || !input.chineseContent) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '缺少必填字段' },
        });
        return;
      }

      const session = await sessionService.createSession(userId, input);
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '创建研习会话失败' },
      });
    }
  });

  /**
   * GET /api/study-sessions
   * 获取用户所有研习会话
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      const sessions = await sessionService.getSessions(userId);
      res.json({ success: true, data: sessions });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取研习会话列表失败' },
      });
    }
  });

  /**
   * GET /api/study-sessions/:id
   * 获取单个研习会话
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      const session = await sessionService.getSession(userId, req.params.id);

      if (!session) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '研习会话不存在' },
        });
        return;
      }

      res.json({ success: true, data: session });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取研习会话失败' },
      });
    }
  });

  /**
   * PUT /api/study-sessions/:id
   * 更新研习会话
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      await sessionService.updateSession(userId, req.params.id, req.body);
      res.json({ success: true, data: { message: '研习会话已更新' } });
    } catch (error) {
      const message = (error as Error).message;

      if (message.includes('NOT_FOUND')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '研习会话不存在' },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '更新研习会话失败' },
      });
    }
  });

  /**
   * POST /api/study-sessions/:id/extract
   * 调用 ContentExtractor 提取英文正文
   */
  router.post('/:id/extract', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      const { url } = req.body;

      if (!url) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'URL 不能为空' },
        });
        return;
      }

      // Verify session exists
      const session = await sessionService.getSession(userId, req.params.id);
      if (!session) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '研习会话不存在' },
        });
        return;
      }

      // Extract content from URL
      const extracted = await contentExtractor.extractFromUrl(url);

      // Update session with extracted content
      await sessionService.updateSession(userId, req.params.id, {
        englishUrl: url,
        englishContent: extracted.content,
        englishHtmlContent: extracted.htmlContent,
        englishSourceName: extracted.siteName,
      });

      res.json({ success: true, data: extracted });
    } catch (error) {
      if (error instanceof ContentExtractorError) {
        if (error.code === 'URL_UNREACHABLE') {
          res.status(400).json({
            success: false,
            error: { code: 'URL_UNREACHABLE', message: error.message },
          });
          return;
        }
        if (error.code === 'EXTRACTION_FAILED') {
          res.status(422).json({
            success: false,
            error: { code: 'EXTRACTION_FAILED', message: error.message },
          });
          return;
        }
      }

      const message = (error as Error).message;
      if (message.includes('NOT_FOUND')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '研习会话不存在' },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '提取英文正文失败' },
      });
    }
  });

  return router;
}

export default createStudySessionsRouter;
