/**
 * JWT 认证中间件
 * 从请求 Cookie 中提取 JWT，验证有效性，挂载用户信息到 req.user
 *
 * Validates: Requirements 1.7, 8.9
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

/**
 * 创建认证中间件工厂函数
 * @param authService - AuthService 实例，用于验证 JWT
 * @returns Express 中间件函数
 */
export function createAuthMiddleware(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.cookies?.jwt;

    if (!token) {
      res.status(401).json({ success: false, error: '未登录，请先登录' });
      return;
    }

    try {
      const payload = authService.verifyToken(token);
      req.user = payload;
      next();
    } catch (error) {
      res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
    }
  };
}
