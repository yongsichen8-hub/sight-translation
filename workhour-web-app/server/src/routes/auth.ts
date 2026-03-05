/**
 * 认证路由
 * 处理飞书 OAuth 登录、回调、用户信息获取和退出登录
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 8.1, 8.2, 8.3, 8.4, 8.10
 */

import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { config } from '../config/index';
import { removeUserToken } from '../services/TokenStore';

export function createAuthRouter(authService: AuthService, authMiddleware: any) {
  const router = Router();

  // GET /feishu - 发起飞书 OAuth 授权，返回授权 URL
  router.get('/feishu', (req: Request, res: Response) => {
    try {
      const { url, state } = authService.getAuthorizationUrl(config.FEISHU_REDIRECT_URI);
      res.json({ success: true, data: { url, state } });
    } catch (error) {
      res.status(500).json({ success: false, error: '生成授权 URL 失败' });
    }
  });

  // GET /feishu/callback - 处理 OAuth 回调，交换 token，设置 JWT Cookie
  router.get('/feishu/callback', async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) {
        res.status(400).json({ success: false, error: '缺少 code 或 state 参数' });
        return;
      }

      const result = await authService.handleCallback(code as string, state as string);

      // Set JWT Cookie: HttpOnly, SameSite=Lax, Max-Age=7 days
      res.cookie('jwt', result.jwt, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      });

      res.json({ success: true, data: { user: result.user } });
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('STATE_MISMATCH')) {
        res.status(400).json({ success: false, error: 'state 参数无效，请重新登录' });
        return;
      }
      if (message.includes('AUTH_CODE_INVALID')) {
        res.status(400).json({ success: false, error: '授权码无效或已过期，请重新登录' });
        return;
      }
      if (message.includes('FEISHU_API_ERROR')) {
        res.status(502).json({ success: false, error: '飞书 API 调用失败，请稍后重试' });
        return;
      }
      res.status(500).json({ success: false, error: '登录失败，请稍后重试' });
    }
  });

  // GET /me - 获取当前登录用户信息（需认证）
  router.get('/me', authMiddleware, (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        userId: req.user!.userId,
        feishuOpenId: req.user!.feishuOpenId,
        name: req.user!.name,
        avatar: req.user!.avatar,
        isAdmin: req.user!.isAdmin || false,
      },
    });
  });

  // POST /logout - 清除 Cookie 退出登录
  router.post('/logout', authMiddleware, (req: Request, res: Response) => {
    // 清除服务端 token 存储
    if (req.user?.feishuOpenId) {
      removeUserToken(req.user.feishuOpenId);
    }
    res.clearCookie('jwt', { httpOnly: true, sameSite: 'lax' });
    res.json({ success: true, data: { message: '已退出登录' } });
  });

  return router;
}
