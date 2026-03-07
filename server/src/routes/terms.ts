import { Router, Request, Response } from 'express';
import { TermService } from '../services/TermService';
import { BriefingDomain, CreateTermInput, TermFilters } from '../types/briefing';

const VALID_DOMAINS: BriefingDomain[] = ['ai-tech', 'economy', 'politics'];
const DEFAULT_USER_ID = 'default-user';

export function createTermsRouter(termService: TermService): Router {
  const router = Router();

  /**
   * POST /api/terms
   * 创建术语
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      const input: CreateTermInput = req.body;

      const term = await termService.createTerm(userId, input);
      res.status(201).json({ success: true, data: term });
    } catch (error) {
      const message = (error as Error).message;

      if (message.includes('VALIDATION_ERROR')) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '中文释义为必填项' },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '创建术语失败' },
      });
    }
  });

  /**
   * GET /api/terms?domain=&keyword=
   * 获取术语列表（支持领域筛选和关键词搜索）
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      const domainParam = req.query.domain as string | undefined;
      const keyword = req.query.keyword as string | undefined;

      if (domainParam && !VALID_DOMAINS.includes(domainParam as BriefingDomain)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_DOMAIN', message: '无效的领域分类' },
        });
        return;
      }

      const filters: TermFilters = {};
      if (domainParam) filters.domain = domainParam as BriefingDomain;
      if (keyword) filters.keyword = keyword;

      const terms = await termService.getTerms(userId, filters);
      res.json({ success: true, data: terms });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取术语列表失败' },
      });
    }
  });

  /**
   * GET /api/terms/:id
   * 获取术语详情
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      const terms = await termService.getTerms(userId);
      const term = terms.find((t) => t.id === req.params.id);

      if (!term) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '术语不存在' },
        });
        return;
      }

      res.json({ success: true, data: term });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '获取术语详情失败' },
      });
    }
  });

  /**
   * PUT /api/terms/:id
   * 更新术语
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      await termService.updateTerm(userId, req.params.id, req.body);
      res.json({ success: true, data: { message: '术语已更新' } });
    } catch (error) {
      const message = (error as Error).message;

      if (message.includes('NOT_FOUND')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '术语不存在' },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '更新术语失败' },
      });
    }
  });

  /**
   * DELETE /api/terms/:id
   * 删除术语
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const userId = DEFAULT_USER_ID;
      await termService.deleteTerm(userId, req.params.id);
      res.json({ success: true, data: { message: '术语已删除' } });
    } catch (error) {
      const message = (error as Error).message;

      if (message.includes('NOT_FOUND')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '术语不存在' },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '删除术语失败' },
      });
    }
  });

  return router;
}

export default createTermsRouter;
