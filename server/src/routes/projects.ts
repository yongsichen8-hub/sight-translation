import { Router, Request, Response } from 'express';
import { dataService } from '../services/DataService';
import { authMiddleware } from '../middleware/authMiddleware';
import { ProjectInput } from '../types';

const router = Router();

// 所有项目路由都需要认证
router.use(authMiddleware);

/**
 * GET /api/projects
 * 获取项目列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const projects = await dataService.getProjects(req.user!.feishuUserId);
    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取项目列表失败',
      },
    });
  }
});

/**
 * GET /api/projects/:id
 * 获取单个项目
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await dataService.getProject(req.user!.feishuUserId, req.params.id);
    
    if (!project) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '项目不存在',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取项目失败',
      },
    });
  }
});

/**
 * POST /api/projects
 * 创建项目
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const input: ProjectInput = req.body;
    
    if (!input.name) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '项目名称不能为空',
        },
      });
      return;
    }

    const project = await dataService.createProject(req.user!.feishuUserId, input);
    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '创建项目失败',
      },
    });
  }
});

/**
 * PUT /api/projects/:id
 * 更新项目
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    await dataService.updateProject(req.user!.feishuUserId, req.params.id, req.body);
    res.json({
      success: true,
      data: { message: '项目已更新' },
    });
  } catch (error) {
    const message = (error as Error).message;
    
    if (message.includes('NOT_FOUND')) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '项目不存在',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新项目失败',
      },
    });
  }
});

/**
 * DELETE /api/projects/:id
 * 删除项目
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await dataService.deleteProject(req.user!.feishuUserId, req.params.id);
    res.json({
      success: true,
      data: { message: '项目已删除' },
    });
  } catch (error) {
    const message = (error as Error).message;
    
    if (message.includes('NOT_FOUND')) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '项目不存在',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '删除项目失败',
      },
    });
  }
});

/**
 * POST /api/projects/:id/checkin
 * 打卡项目
 */
router.post('/:id/checkin', async (req: Request, res: Response) => {
  try {
    await dataService.checkInProject(req.user!.feishuUserId, req.params.id);
    res.json({
      success: true,
      data: { message: '打卡成功' },
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes('NOT_FOUND')) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '项目不存在',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '打卡失败',
      },
    });
  }
});

export default router;
