/**
 * 认证服务 - 处理飞书 OAuth 和 JWT
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6
 */

import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { config } from '../config/index';
import { JwtPayload, UserInfo } from '../types/index';
import { TrackerService } from './TrackerService';
import { saveUserToken } from './TokenStore';

function isAdminUser(openId: string): boolean {
  return config.ADMIN_OPEN_IDS.includes(openId);
}

// 存储 state 参数（生产环境应使用 Redis）
const stateStore = new Map<string, { createdAt: number }>();
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 分钟

/**
 * 认证服务类
 * 负责飞书 OAuth 授权流程、JWT 签发与验证
 */
export class AuthService {
  private trackerService: TrackerService;

  constructor(trackerService: TrackerService) {
    this.trackerService = trackerService;
  }

  /**
   * 生成飞书 OAuth 授权 URL
   * 包含随机 state 参数防止 CSRF 攻击
   *
   * Validates: Requirements 1.1, 1.5
   */
  getAuthorizationUrl(redirectUri: string): { url: string; state: string } {
    const state = crypto.randomBytes(32).toString('hex');

    stateStore.set(state, { createdAt: Date.now() });
    this.cleanupExpiredStates();

    const params = new URLSearchParams({
      app_id: config.FEISHU_APP_ID,
      redirect_uri: redirectUri,
      state,
      // 请求多维表格读写权限，这样 user_access_token 才能操作 Bitable
      scope: 'bitable:app',
    });

    return {
      url: `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`,
      state,
    };
  }

  /**
   * 清理过期的 state
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, data] of stateStore.entries()) {
      if (now - data.createdAt > STATE_EXPIRY_MS) {
        stateStore.delete(state);
      }
    }
  }

  /**
   * 验证 state 参数
   */
  private validateState(state: string): boolean {
    const data = stateStore.get(state);
    if (!data) {
      return false;
    }

    if (Date.now() - data.createdAt > STATE_EXPIRY_MS) {
      stateStore.delete(state);
      return false;
    }

    // 使用后删除（一次性）
    stateStore.delete(state);
    return true;
  }

  /**
   * 处理 OAuth 回调
   * 交换 access_token → 获取用户信息 → 创建/查找译员 → 签发 JWT
   *
   * Validates: Requirements 1.2, 1.3, 1.6
   */
  async handleCallback(code: string, state: string): Promise<{ jwt: string; user: UserInfo }> {
    // 1. 验证 state 防 CSRF
    if (!this.validateState(state)) {
      throw new Error('STATE_MISMATCH: state 参数无效或已过期');
    }

    // 2. 获取 app_access_token
    const appTokenRes = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
      { app_id: config.FEISHU_APP_ID, app_secret: config.FEISHU_APP_SECRET }
    );
    if (appTokenRes.data.code !== 0) {
      throw new Error(`FEISHU_API_ERROR: 获取 app_access_token 失败 - ${appTokenRes.data.msg}`);
    }

    // 3. 用授权码换取 user_access_token
    const tokenRes = await axios.post(
      'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
      { grant_type: 'authorization_code', code },
      { headers: { Authorization: `Bearer ${appTokenRes.data.app_access_token}` } }
    );
    if (tokenRes.data.code !== 0) {
      throw new Error(`AUTH_CODE_INVALID: ${tokenRes.data.msg}`);
    }

    const userAccessToken = tokenRes.data.data.access_token;
    const refreshToken = tokenRes.data.data.refresh_token;
    const expiresIn = tokenRes.data.data.expires_in || 7200;

    console.log('[Auth] Token exchange success, expires_in:', expiresIn);
    console.log('[Auth] Has refresh_token:', !!refreshToken);

    // 4. 获取用户信息
    const userRes = await axios.get(
      'https://open.feishu.cn/open-apis/authen/v1/user_info',
      { headers: { Authorization: `Bearer ${userAccessToken}` } }
    );
    if (userRes.data.code !== 0) {
      throw new Error(`FEISHU_API_ERROR: 获取用户信息失败 - ${userRes.data.msg}`);
    }

    const feishuUser = userRes.data.data;
    const openId: string = feishuUser.open_id;
    const name: string = feishuUser.name;
    const avatar: string | undefined = feishuUser.avatar_url;

    console.log('[Auth] User info:', { openId, name });

    // 5. 保存 user_access_token 和 refresh_token 到内存
    saveUserToken(openId, userAccessToken, refreshToken, expiresIn);
    console.log('[Auth] Token saved for user:', openId);

    // 6. 查找或创建译员
    const translator = await this.trackerService.findOrCreateTranslator(openId, name);

    // 7. 签发 JWT（有效期 7 天）— 不再包含 userAccessToken
    const admin = isAdminUser(openId);
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: translator.id,
      feishuOpenId: openId,
      name,
      avatar,
      isAdmin: admin,
    };
    const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });

    return {
      jwt: token,
      user: { userId: translator.id, feishuOpenId: openId, name, avatar, isAdmin: admin },
    };
  }

  /**
   * 验证并解码 JWT 令牌
   *
   * Validates: Requirements 1.6, 1.7
   */
  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('TOKEN_EXPIRED: JWT 令牌已过期');
      }
      throw new Error('TOKEN_INVALID: JWT 令牌无效');
    }
  }
}
