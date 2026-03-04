import { Router, Request, Response } from 'express';
import { dataService } from '../services/DataService';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// 所有闪卡路由都需要认证
router.use(authMiddleware);

/**
 * GET /api/flashcards
 * 获取所有闪卡
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const flashcards = await dataService.getFlashcards(req.user!.feishuUserId);
    res.json({
      success: true,
      data: flashcards,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取闪卡列表失败',
      },
    });
  }
});

/**
 * GET /api/flashcards/due
 * 获取待复习闪卡
 */
router.get('/due', async (req: Request, res: Response) => {
  try {
    const flashcards = await dataService.getDueFlashcards(req.user!.feishuUserId);
    res.json({
      success: true,
      data: flashcards,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取待复习闪卡失败',
      },
    });
  }
});

/**
 * POST /api/flashcards/:id/review
 * 记录复习结果
 */
router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { remembered } = req.body;
    
    if (typeof remembered !== 'boolean') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'remembered 参数必须是布尔值',
        },
      });
      return;
    }

    await dataService.recordReview(req.user!.feishuUserId, req.params.id, remembered);
    res.json({
      success: true,
      data: { message: '复习记录已保存' },
    });
  } catch (error) {
    const message = (error as Error).message;
    
    if (message.includes('NOT_FOUND')) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '闪卡不存在',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '记录复习结果失败',
      },
    });
  }
});

/**
 * GET /api/flashcards/:id/records
 * 获取闪卡的复习记录
 */
router.get('/:id/records', async (req: Request, res: Response) => {
  try {
    const records = await dataService.getReviewRecords(req.user!.feishuUserId, req.params.id);
    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取复习记录失败',
      },
    });
  }
});

export default router;
