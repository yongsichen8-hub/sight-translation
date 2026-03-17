import { Router, Request, Response } from 'express';
import { authService } from '../services/AuthService';
import { authMiddleware } from '../middleware/authMiddleware';
import { config } from '../config';

const router = Router();

/**
 * POST /api/auth/register
 * 注册新用户
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const result = await authService.register(username, password);

    res.cookie('jwt', result.jwt, {
      httpOnly: config.cookie.httpOnly,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      maxAge: config.cookie.maxAge,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          userId: result.user.id,
          feishuUserId: result.user.feishuUserId,
          username: result.user.username,
          name: result.user.name,
          avatar: result.user.avatar,
        },
      },
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes('VALIDATION_ERROR')) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: message.split(': ')[1] },
      });
      return;
    }

    if (message.includes('DUPLICATE_USER')) {
      res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_USER', message: '用户名已存在' },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '注册失败，请稍后重试' },
    });
  }
});

/**
 * POST /api/auth/login
 * 用户名密码登录
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);

    res.cookie('jwt', result.jwt, {
      httpOnly: config.cookie.httpOnly,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      maxAge: config.cookie.maxAge,
    });

    res.json({
      success: true,
      data: {
        user: {
          userId: result.user.id,
          feishuUserId: result.user.feishuUserId,
          username: result.user.username,
          name: result.user.name,
          avatar: result.user.avatar,
        },
      },
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes('VALIDATION_ERROR')) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: message.split(': ')[1] },
      });
      return;
    }

    if (message.includes('AUTH_FAILED')) {
      res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: '用户名或密码错误' },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '登录失败，请稍后重试' },
    });
  }
});

/**
 * POST /api/auth/migrate-feishu
 * 迁移飞书用户到用户名密码登录
 */
router.post('/migrate-feishu', async (req: Request, res: Response) => {
  try {
    const { feishuUserId, username, password } = req.body;
    const result = await authService.migrateFeishuUser(feishuUserId, username, password);

    res.cookie('jwt', result.jwt, {
      httpOnly: config.cookie.httpOnly,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      maxAge: config.cookie.maxAge,
    });

    res.json({
      success: true,
      data: {
        user: {
          userId: result.user.id,
          feishuUserId: result.user.feishuUserId,
          username: result.user.username,
          name: result.user.name,
          avatar: result.user.avatar,
        },
      },
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes('VALIDATION_ERROR') || message.includes('DUPLICATE_USER') || message.includes('NOT_FOUND')) {
      res.status(400).json({
        success: false,
        error: { code: 'MIGRATION_ERROR', message: message.split(': ')[1] },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '迁移失败，请稍后重试' },
    });
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      userId: req.user!.userId,
      feishuUserId: req.user!.feishuUserId,
      username: req.user!.username,
      name: req.user!.name,
    },
  });
});

/**
 * POST /api/auth/logout
 * 退出登录
 */
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  res.clearCookie('jwt', {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
  });

  res.json({
    success: true,
    data: { message: '已退出登录' },
  });
});

export default router;
