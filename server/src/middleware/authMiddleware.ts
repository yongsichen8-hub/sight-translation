import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/AuthService';

/**
 * 认证中间件 - 验证 JWT Cookie
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 从 Cookie 获取 JWT
    const token = req.cookies?.jwt;

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未登录，请先登录',
        },
      });
      return;
    }

    // 验证 JWT
    const payload = authService.verifyToken(token);

    // 将用户信息注入 request
    req.user = payload;

    next();
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes('TOKEN_EXPIRED')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: '登录已过期，请重新登录',
        },
      });
      return;
    }

    if (message.includes('TOKEN_INVALID')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: '登录凭证无效，请重新登录',
        },
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '认证失败',
      },
    });
  }
};

/**
 * 可选认证中间件 - 如果有 token 则验证，没有则继续
 */
export const optionalAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.cookies?.jwt;

    if (token) {
      const payload = authService.verifyToken(token);
      req.user = payload;
    }

    next();
  } catch {
    // 验证失败，但不阻止请求
    next();
  }
};
