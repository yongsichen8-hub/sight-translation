import { Router, Request, Response } from 'express';
import { dataService } from '../services/DataService';
import { authMiddleware } from '../middleware/authMiddleware';
import { LocalDataExport, MigrationResult } from '../types';

const router = Router();

// 迁移路由需要认证
router.use(authMiddleware);

/**
 * POST /api/migration/import
 * 导入本地数据
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const data: LocalDataExport = req.body;
    const userId = req.user!.feishuUserId;

    // 验证数据格式
    if (!data || typeof data !== 'object') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '无效的数据格式',
        },
      });
      return;
    }

    const result: MigrationResult = {
      success: true,
      imported: {
        projects: 0,
        expressions: 0,
        flashcards: 0,
        reviewRecords: 0,
      },
      errors: [],
    };

    // 导入项目
    if (data.projects && Array.isArray(data.projects)) {
      try {
        result.imported.projects = await dataService.importProjects(userId, data.projects);
      } catch (error) {
        result.errors.push(`项目导入失败: ${(error as Error).message}`);
      }
    }

    // 导入表达
    if (data.expressions && Array.isArray(data.expressions)) {
      try {
        result.imported.expressions = await dataService.importExpressions(userId, data.expressions);
      } catch (error) {
        result.errors.push(`表达导入失败: ${(error as Error).message}`);
      }
    }

    // 导入闪卡
    if (data.flashcards && Array.isArray(data.flashcards)) {
      try {
        result.imported.flashcards = await dataService.importFlashcards(userId, data.flashcards);
      } catch (error) {
        result.errors.push(`闪卡导入失败: ${(error as Error).message}`);
      }
    }

    // 导入复习记录
    if (data.reviewRecords && Array.isArray(data.reviewRecords)) {
      try {
        result.imported.reviewRecords = await dataService.importReviewRecords(userId, data.reviewRecords);
      } catch (error) {
        result.errors.push(`复习记录导入失败: ${(error as Error).message}`);
      }
    }

    // 如果有错误，标记为部分成功
    if (result.errors.length > 0) {
      result.success = false;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '数据导入失败',
      },
    });
  }
});

export default router;
