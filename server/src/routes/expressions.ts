import { Router, Request, Response } from 'express';
import { dataService } from '../services/DataService';
import { authMiddleware } from '../middleware/authMiddleware';
import { ExpressionInput } from '../types';

const router = Router();

// 所有表达路由都需要认证
router.use(authMiddleware);

/**
 * GET /api/expressions
 * 获取表达列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const keyword = req.query.keyword as string | undefined;
    const expressions = await dataService.getExpressions(req.user!.feishuUserId, keyword);
    res.json({
      success: true,
      data: expressions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取表达列表失败',
      },
    });
  }
});

/**
 * GET /api/expressions/:id
 * 获取单个表达
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const expression = await dataService.getExpression(req.user!.feishuUserId, req.params.id);
    
    if (!expression) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '表达不存在',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: expression,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取表达失败',
      },
    });
  }
});

/**
 * POST /api/expressions
 * 创建表达
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const input: ExpressionInput = req.body;
    
    if (!input.chinese || !input.english) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '中文和英文内容不能为空',
        },
      });
      return;
    }

    if (!input.projectId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '项目 ID 不能为空',
        },
      });
      return;
    }

    const expression = await dataService.createExpression(req.user!.feishuUserId, input);
    res.status(201).json({
      success: true,
      data: expression,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '创建表达失败',
      },
    });
  }
});

/**
 * PUT /api/expressions/:id
 * 更新表达
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    await dataService.updateExpression(req.user!.feishuUserId, req.params.id, req.body);
    res.json({
      success: true,
      data: { message: '表达已更新' },
    });
  } catch (error) {
    const message = (error as Error).message;
    
    if (message.includes('NOT_FOUND')) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '表达不存在',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新表达失败',
      },
    });
  }
});

/**
 * DELETE /api/expressions/:id
 * 删除表达
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await dataService.deleteExpression(req.user!.feishuUserId, req.params.id);
    res.json({
      success: true,
      data: { message: '表达已删除' },
    });
  } catch (error) {
    const message = (error as Error).message;
    
    if (message.includes('NOT_FOUND')) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '表达不存在',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '删除表达失败',
      },
    });
  }
});

export default router;
