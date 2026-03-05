import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createAuthRouter } from './auth';

// Mock AuthService
function createMockAuthService() {
  return {
    getAuthorizationUrl: vi.fn(),
    handleCallback: vi.fn(),
    verifyToken: vi.fn(),
  };
}

// Mock auth middleware that either passes or rejects
function createPassingMiddleware() {
  return (req: any, _res: any, next: any) => {
    req.user = {
      userId: 'translator_123',
      feishuOpenId: 'ou_abc',
      name: '张三',
      avatar: 'https://example.com/avatar.png',
    };
    next();
  };
}

function createRejectingMiddleware() {
  return (_req: any, res: any) => {
    res.status(401).json({ success: false, error: '未登录' });
  };
}

function createApp(authService: any, authMiddleware: any) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(authService, authMiddleware));
  return app;
}

describe('Auth Routes', () => {
  let mockAuthService: ReturnType<typeof createMockAuthService>;

  beforeEach(() => {
    mockAuthService = createMockAuthService();
  });

  describe('GET /api/auth/feishu', () => {
    it('should return authorization URL and state', async () => {
      mockAuthService.getAuthorizationUrl.mockReturnValue({
        url: 'https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=test',
        state: 'random_state_123',
      });

      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/feishu');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          url: 'https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=test',
          state: 'random_state_123',
        },
      });
    });

    it('should return 500 when getAuthorizationUrl throws', async () => {
      mockAuthService.getAuthorizationUrl.mockImplementation(() => {
        throw new Error('config error');
      });

      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/feishu');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: '生成授权 URL 失败' });
    });
  });

  describe('GET /api/auth/feishu/callback', () => {
    it('should handle successful callback and set JWT cookie', async () => {
      mockAuthService.handleCallback.mockResolvedValue({
        jwt: 'jwt_token_abc',
        user: { userId: 'translator_1', feishuOpenId: 'ou_x', name: '李四' },
      });

      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/feishu/callback?code=auth_code&state=valid_state');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { user: { userId: 'translator_1', feishuOpenId: 'ou_x', name: '李四' } },
      });

      // Verify JWT cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const jwtCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('jwt='))
        : cookies;
      expect(jwtCookie).toContain('jwt=jwt_token_abc');
      expect(jwtCookie).toContain('HttpOnly');
      expect(jwtCookie).toContain('SameSite=Lax');
      expect(jwtCookie).toContain('Max-Age=604800');
    });

    it('should return 400 when code is missing', async () => {
      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/feishu/callback?state=valid_state');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: '缺少 code 或 state 参数' });
    });

    it('should return 400 when state is missing', async () => {
      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/feishu/callback?code=auth_code');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: '缺少 code 或 state 参数' });
    });

    it('should return 400 on STATE_MISMATCH error', async () => {
      mockAuthService.handleCallback.mockRejectedValue(new Error('STATE_MISMATCH: invalid'));

      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/feishu/callback?code=c&state=s');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: 'state 参数无效，请重新登录' });
    });

    it('should return 400 on AUTH_CODE_INVALID error', async () => {
      mockAuthService.handleCallback.mockRejectedValue(new Error('AUTH_CODE_INVALID: expired'));

      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/feishu/callback?code=c&state=s');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: '授权码无效或已过期，请重新登录' });
    });

    it('should return 502 on FEISHU_API_ERROR', async () => {
      mockAuthService.handleCallback.mockRejectedValue(new Error('FEISHU_API_ERROR: timeout'));

      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/feishu/callback?code=c&state=s');

      expect(res.status).toBe(502);
      expect(res.body).toEqual({ success: false, error: '飞书 API 调用失败，请稍后重试' });
    });

    it('should return 500 on unknown error', async () => {
      mockAuthService.handleCallback.mockRejectedValue(new Error('unexpected'));

      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/feishu/callback?code=c&state=s');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: '登录失败，请稍后重试' });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info when authenticated', async () => {
      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          userId: 'translator_123',
          feishuOpenId: 'ou_abc',
          name: '张三',
          avatar: 'https://example.com/avatar.png',
        },
      });
    });

    it('should return 401 when not authenticated', async () => {
      const app = createApp(mockAuthService, createRejectingMiddleware());
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear JWT cookie and return success', async () => {
      const app = createApp(mockAuthService, createPassingMiddleware());
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { message: '已退出登录' } });

      // Verify cookie is cleared
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const jwtCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('jwt='))
        : cookies;
      expect(jwtCookie).toContain('jwt=');
      expect(jwtCookie).toContain('Expires=');
    });
  });

  describe('Unified JSON response format', () => {
    it('all success responses should have success: true and data field', async () => {
      mockAuthService.getAuthorizationUrl.mockReturnValue({ url: 'u', state: 's' });
      const app = createApp(mockAuthService, createPassingMiddleware());

      const feishuRes = await request(app).get('/api/auth/feishu');
      expect(feishuRes.body.success).toBe(true);
      expect(feishuRes.body.data).toBeDefined();

      const meRes = await request(app).get('/api/auth/me');
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data).toBeDefined();

      const logoutRes = await request(app).post('/api/auth/logout');
      expect(logoutRes.body.success).toBe(true);
      expect(logoutRes.body.data).toBeDefined();
    });

    it('all error responses should have success: false and error field', async () => {
      mockAuthService.getAuthorizationUrl.mockImplementation(() => { throw new Error('fail'); });
      const app = createApp(mockAuthService, createPassingMiddleware());

      const feishuRes = await request(app).get('/api/auth/feishu');
      expect(feishuRes.body.success).toBe(false);
      expect(feishuRes.body.error).toBeDefined();
    });
  });
});
