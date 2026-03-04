import { Router, Request, Response } from 'express';
import { authService } from '../services/AuthService';
import { authMiddleware } from '../middleware/authMiddleware';
import { config } from '../config';

const router = Router();

/**
 * GET /api/auth/feishu/login
 * 获取飞书授权 URL
 */
router.get('/feishu/login', (req: Request, res: Response) => {
  try {
    const { url, state } = authService.getAuthorizationUrl(config.feishu.redirectUri);
    
    res.json({
      success: true,
      data: { url, state },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '生成授权 URL 失败',
      },
    });
  }
});

/**
 * GET /api/auth/feishu/callback
 * 处理 OAuth 回调
 */
router.get('/feishu/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: '缺少 code 或 state 参数',
        },
      });
      return;
    }

    const result = await authService.handleCallback(
      code as string,
      state as string
    );

    // 设置 JWT Cookie
    res.cookie('jwt', result.jwt, {
      httpOnly: config.cookie.httpOnly,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      maxAge: config.cookie.maxAge,
    });

    res.json({
      success: true,
      data: {
        user: result.user,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes('STATE_MISMATCH')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'STATE_MISMATCH',
          message: 'state 参数无效，可能存在 CSRF 攻击',
        },
      });
      return;
    }

    if (message.includes('AUTH_CODE_INVALID')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'AUTH_CODE_INVALID',
          message: '授权码无效或已过期，请重新登录',
        },
      });
      return;
    }

    if (message.includes('FEISHU_API_ERROR')) {
      res.status(502).json({
        success: false,
        error: {
          code: 'FEISHU_API_ERROR',
          message: '飞书 API 调用失败，请稍后重试',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '登录失败，请稍后重试',
      },
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
      name: req.user!.name,
    },
  });
});

/**
 * POST /api/auth/logout
 * 退出登录
 */
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  // 清除 JWT Cookie
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
