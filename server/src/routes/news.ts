import { Router, Request, Response } from 'express';
import { NewsStorageService } from '../services/NewsStorageService';
import { SourceRegistryService } from '../services/SourceRegistryService';
import { NewsScheduler } from '../services/NewsScheduler';
import { NewsDomain } from '../types/news';

const VALID_DOMAINS: NewsDomain[] = ['ai', 'tech', 'economy', 'politics'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function createNewsRouter(
  storageService: NewsStorageService,
  sourceRegistry: SourceRegistryService,
  scheduler: NewsScheduler,
): Router {
  const router = Router();

  /**
   * GET /api/news/daily?date=YYYY-MM-DD&domain=ai
   * 获取指定日期的每日新闻列表（默认今天），可按领域筛选
   */
  router.get('/daily', async (req: Request, res: Response) => {
    try {
      const dateParam = req.query.date as string | undefined;
      const domainParam = req.query.domain as string | undefined;

      // Validate date format
      const date = dateParam || new Date().toISOString().slice(0, 10);
      if (!DATE_REGEX.test(date) || isNaN(Date.parse(date))) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_DATE', message: '日期格式无效' },
        });
        return;
      }

      // Validate domain parameter
      if (domainParam && !VALID_DOMAINS.includes(domainParam as NewsDomain)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_DOMAIN', message: '无效的领域分类' },
        });
        return;
      }

      const dailyNews = await storageService.getDailyNews(date);
      if (!dailyNews) {
        res.status(404).json({
          success: false,
          error: { code: 'NO_DATA', message: '该日期暂无新闻数据' },
        });
        return;
      }

      let items = dailyNews.items;
      if (domainParam) {
        const domain = domainParam as NewsDomain;
        items = items.filter(
          (item) => item.domain === domain || item.secondaryDomains.includes(domain),
        );
      }

      res.json({
        success: true,
        data: {
          date: dailyNews.date,
          items,
          generatedAt: dailyNews.generatedAt,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
      });
    }
  });

  /**
   * GET /api/news/sources
   * 获取所有注册新闻源列表
   */
  router.get('/sources', (_req: Request, res: Response) => {
    try {
      const sources = sourceRegistry.getSources();
      res.json({ success: true, data: sources });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
      });
    }
  });

  /**
   * GET /api/news/:id
   * 获取单条新闻详情（含中英文全文）
   * 需要 date 查询参数来定位文件，默认今天
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const dateParam = req.query.date as string | undefined;
      const date = dateParam || new Date().toISOString().slice(0, 10);

      if (!DATE_REGEX.test(date) || isNaN(Date.parse(date))) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_DATE', message: '日期格式无效' },
        });
        return;
      }

      const item = await storageService.getNewsItemById(date, id);
      if (!item) {
        res.status(404).json({
          success: false,
          error: { code: 'NO_DATA', message: '该日期暂无新闻数据' },
        });
        return;
      }

      res.json({ success: true, data: item });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
      });
    }
  });

  /**
   * POST /api/news/trigger
   * 手动触发新闻更新
   */
  router.post('/trigger', async (_req: Request, res: Response) => {
    try {
      const result = await scheduler.triggerUpdate();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
      });
    }
  });

  return router;
}

export default createNewsRouter;
