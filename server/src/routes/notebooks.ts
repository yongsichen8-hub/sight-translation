import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { NotebookService } from '../services/NotebookService';

/**
 * 创建笔记本路由
 * @param notebookService NotebookService 实例
 */
export function createNotebookRoutes(notebookService: NotebookService): Router {
  const router = Router();

  // 所有路由都需要认证
  router.use(authMiddleware);

  // ==================== AI 设置路由（必须在 /:id 之前定义） ====================

  /**
   * GET /api/notebooks/settings/ai
   * 获取用户 AI 配置
   */
  router.get('/settings/ai', async (req: Request, res: Response) => {
    try {
      const settings = await notebookService.getAiSettings(req.user!.feishuUserId);
      res.json({ success: true, data: settings });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取 AI 配置失败' },
      });
    }
  });

  /**
   * PUT /api/notebooks/settings/ai
   * 保存用户 AI 配置
   */
  router.put('/settings/ai', async (req: Request, res: Response) => {
    try {
      await notebookService.saveAiSettings(req.user!.feishuUserId, req.body);
      res.json({ success: true, data: { message: 'AI 配置已保存' } });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('VALIDATION_ERROR')) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: message.split(': ')[1] || '验证失败' },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '保存 AI 配置失败' },
      });
    }
  });

  // ==================== 项目 CRUD 路由 ====================

  /**
   * GET /api/notebooks
   * 获取用户笔记本项目列表
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const notebooks = await notebookService.getNotebooks(req.user!.feishuUserId);
      res.json({ success: true, data: notebooks });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取项目列表失败' },
      });
    }
  });

  /**
   * POST /api/notebooks
   * 创建笔记本项目
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const notebook = await notebookService.createNotebook(req.user!.feishuUserId, req.body);
      res.status(201).json({ success: true, data: notebook });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('VALIDATION_ERROR')) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: message.split(': ')[1] || '验证失败' },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '创建项目失败' },
      });
    }
  });

  /**
   * PUT /api/notebooks/:id
   * 更新笔记本项目
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      await notebookService.updateNotebook(req.user!.feishuUserId, req.params.id, req.body);
      res.json({ success: true, data: { message: '项目已更新' } });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('NOT_FOUND')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '笔记本项目不存在' },
        });
        return;
      }
      if (message.includes('VALIDATION_ERROR')) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: message.split(': ')[1] || '验证失败' },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '更新项目失败' },
      });
    }
  });

  /**
   * DELETE /api/notebooks/:id
   * 删除笔记本项目
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await notebookService.deleteNotebook(req.user!.feishuUserId, req.params.id);
      res.json({ success: true, data: { message: '项目已删除' } });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('NOT_FOUND')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '笔记本项目不存在' },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '删除项目失败' },
      });
    }
  });

  // ==================== 备忘录路由 ====================

  /**
   * GET /api/notebooks/:id/memo
   * 获取备忘录内容
   */
  router.get('/:id/memo', async (req: Request, res: Response) => {
    try {
      const memo = await notebookService.getMemo(req.user!.feishuUserId, req.params.id);
      res.json({ success: true, data: memo });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取备忘录失败' },
      });
    }
  });

  /**
   * PUT /api/notebooks/:id/memo
   * 保存备忘录内容
   */
  router.put('/:id/memo', async (req: Request, res: Response) => {
    try {
      await notebookService.saveMemo(req.user!.feishuUserId, req.params.id, req.body);
      res.json({ success: true, data: { message: '备忘录已保存' } });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('CONTENT_TOO_LARGE')) {
        res.status(413).json({
          success: false,
          error: { code: 'CONTENT_TOO_LARGE', message: '备忘录内容过大，请精简内容（上限 5MB）' },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '保存备忘录失败' },
      });
    }
  });

  // ==================== AI 整理路由 ====================

  /**
   * GET /api/notebooks/:id/organized
   * 获取整理结果
   */
  router.get('/:id/organized', async (req: Request, res: Response) => {
    try {
      const result = await notebookService.getOrganizedResult(req.user!.feishuUserId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取整理结果失败' },
      });
    }
  });

  /**
   * POST /api/notebooks/:id/organize
   * 触发 AI 一键整理
   */
  router.post('/:id/organize', async (req: Request, res: Response) => {
    try {
      const result = await notebookService.organizeNotes(req.user!.feishuUserId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('AI_NOT_CONFIGURED')) {
        res.status(400).json({
          success: false,
          error: { code: 'AI_NOT_CONFIGURED', message: '请先在设置中配置 AI 服务的 API Key、Base URL 和模型' },
        });
        return;
      }
      if (message.includes('AI_TIMEOUT')) {
        res.status(504).json({
          success: false,
          error: { code: 'AI_TIMEOUT', message: 'AI 整理请求超时（60 秒），请稍后重试' },
        });
        return;
      }
      if (message.includes('AI_API_ERROR')) {
        res.status(502).json({
          success: false,
          error: { code: 'AI_API_ERROR', message: message.split(': ').slice(1).join(': ') || 'AI 服务错误' },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'AI 整理失败' },
      });
    }
  });

  // ==================== 双语表达导出路由 ====================

  /**
   * POST /api/notebooks/:id/export-expressions
   * AI 识别双语表达
   */
  router.post('/:id/export-expressions', async (req: Request, res: Response) => {
    try {
      const expressions = await notebookService.extractBilingualExpressions(req.user!.feishuUserId, req.params.id);
      res.json({ success: true, data: expressions });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('AI_NOT_CONFIGURED')) {
        res.status(400).json({
          success: false,
          error: { code: 'AI_NOT_CONFIGURED', message: '请先在设置中配置 AI 服务的 API Key、Base URL 和模型' },
        });
        return;
      }
      if (message.includes('AI_TIMEOUT')) {
        res.status(504).json({
          success: false,
          error: { code: 'AI_TIMEOUT', message: '双语表达识别请求超时（60 秒），请稍后重试' },
        });
        return;
      }
      if (message.includes('AI_API_ERROR')) {
        res.status(502).json({
          success: false,
          error: { code: 'AI_API_ERROR', message: message.split(': ').slice(1).join(': ') || 'AI 服务错误' },
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '双语表达识别失败' },
      });
    }
  });

  return router;
}
