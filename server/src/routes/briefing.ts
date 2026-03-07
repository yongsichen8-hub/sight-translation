import { Router, Request, Response } from 'express';
import { BriefingStorageService } from '../services/BriefingStorageService';
import { BriefingScheduler } from '../services/BriefingScheduler';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function createBriefingRouter(
  storageService: BriefingStorageService,
  scheduler: BriefingScheduler,
): Router {
  const router = Router();

  /**
   * GET /api/briefing/daily?date=YYYY-MM-DD
   * 获取指定日期简报（默认今天）
   */
  router.get('/daily', async (req: Request, res: Response) => {
    try {
      const dateParam = req.query.date as string | undefined;
      const date = dateParam || new Date().toISOString().slice(0, 10);

      if (!DATE_REGEX.test(date) || isNaN(Date.parse(date))) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_DATE', message: '日期格式无效，请使用 YYYY-MM-DD 格式' },
        });
        return;
      }

      const briefing = await storageService.getDailyBriefing(date);
      if (!briefing) {
        res.status(404).json({
          success: false,
          error: { code: 'NO_DATA', message: '该日期暂无简报数据' },
        });
        return;
      }

      res.json({ success: true, data: briefing });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取简报失败' },
      });
    }
  });

  /**
   * GET /api/briefing/entry/:entryId?date=YYYY-MM-DD
   * 获取单条新闻条目详情
   */
  router.get('/entry/:entryId', async (req: Request, res: Response) => {
    try {
      const { entryId } = req.params;
      const dateParam = req.query.date as string | undefined;
      const date = dateParam || new Date().toISOString().slice(0, 10);

      if (!DATE_REGEX.test(date) || isNaN(Date.parse(date))) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_DATE', message: '日期格式无效，请使用 YYYY-MM-DD 格式' },
        });
        return;
      }

      const entry = await storageService.getNewsEntry(date, entryId);
      if (!entry) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '新闻条目不存在' },
        });
        return;
      }

      res.json({ success: true, data: entry });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取新闻条目失败' },
      });
    }
  });

  /**
   * POST /api/briefing/trigger
   * 手动触发简报生成
   */
  router.post('/trigger', async (_req: Request, res: Response) => {
    try {
      const result = await scheduler.triggerGeneration();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '触发简报生成失败' },
      });
    }
  });

  return router;
}

export default createBriefingRouter;
