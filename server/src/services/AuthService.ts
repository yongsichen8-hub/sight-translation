import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { 
  User, 
  FeishuUserInfo, 
  FeishuTokenResponse, 
  AuthResult, 
  JWTPayload 
} from '../types';
import { fileStorageService } from './FileStorageService';
import { v4 as uuidv4 } from 'uuid';

// 存储 state 参数（生产环境应使用 Redis）
const stateStore = new Map<string, { createdAt: number; redirectUri: string }>();
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 分钟

/**
 * 认证服务 - 处理飞书 OAuth 和 JWT
 */
export class AuthService {
  /**
   * 生成飞书 OAuth 授权 URL
   */
  getAuthorizationUrl(redirectUri: string): { url: string; state: string } {
    // 生成随机 state 参数
    const state = crypto.randomBytes(32).toString('hex');
    
    // 存储 state
    stateStore.set(state, { 
      createdAt: Date.now(), 
      redirectUri 
    });
    
    // 清理过期的 state
    this.cleanupExpiredStates();
    
    // 构建授权 URL
    const params = new URLSearchParams({
      app_id: config.feishu.appId,
      redirect_uri: redirectUri,
      state,
    });
    
    const url = `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`;
    
    return { url, state };
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
  validateState(state: string): boolean {
    const data = stateStore.get(state);
    if (!data) {
      return false;
    }
    
    // 检查是否过期
    if (Date.now() - data.createdAt > STATE_EXPIRY_MS) {
      stateStore.delete(state);
      return false;
    }
    
    // 使用后删除
    stateStore.delete(state);
    return true;
  }


  /**
   * 处理 OAuth 回调
   */
  async handleCallback(code: string, state: string): Promise<AuthResult> {
    // 验证 state
    if (!this.validateState(state)) {
      throw new Error('STATE_MISMATCH: state 参数无效或已过期');
    }
    
    // 用授权码换取 access_token
    const tokenResponse = await this.exchangeToken(code);
    
    // 获取用户信息
    const feishuUser = await this.getUserInfo(tokenResponse.access_token);
    
    // 创建或更新用户
    const user = await this.findOrCreateUser(feishuUser);
    
    // 生成 JWT
    const jwtToken = this.generateToken(user);
    
    return {
      user,
      jwt: jwtToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 天（秒）
    };
  }

  /**
   * 用授权码换取 access_token
   */
  async exchangeToken(code: string): Promise<FeishuTokenResponse> {
    // 先获取 app_access_token
    const appTokenResponse = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: config.feishu.appId,
          app_secret: config.feishu.appSecret,
        }),
      }
    );
    
    const appTokenData = await appTokenResponse.json() as { 
      code: number; 
      msg: string; 
      app_access_token: string 
    };
    
    if (appTokenData.code !== 0) {
      throw new Error(`FEISHU_API_ERROR: 获取 app_access_token 失败 - ${appTokenData.msg}`);
    }
    
    // 用授权码换取 user_access_token
    const response = await fetch(
      'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appTokenData.app_access_token}`,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
        }),
      }
    );
    
    const data = await response.json() as { 
      code: number; 
      msg: string; 
      data: FeishuTokenResponse 
    };
    
    if (data.code !== 0) {
      if (data.msg.includes('expired') || data.msg.includes('invalid')) {
        throw new Error('AUTH_CODE_INVALID: 授权码无效或已过期');
      }
      throw new Error(`FEISHU_API_ERROR: 换取 token 失败 - ${data.msg}`);
    }
    
    return data.data;
  }

  /**
   * 获取飞书用户信息
   */
  async getUserInfo(accessToken: string): Promise<FeishuUserInfo> {
    const response = await fetch(
      'https://open.feishu.cn/open-apis/authen/v1/user_info',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    const data = await response.json() as { 
      code: number; 
      msg: string; 
      data: FeishuUserInfo 
    };
    
    if (data.code !== 0) {
      throw new Error(`FEISHU_API_ERROR: 获取用户信息失败 - ${data.msg}`);
    }
    
    return data.data;
  }


  /**
   * 查找或创建用户
   */
  async findOrCreateUser(feishuUser: FeishuUserInfo): Promise<User> {
    const userId = feishuUser.union_id || feishuUser.open_id;
    
    // 确保用户目录存在
    await fileStorageService.ensureUserDir(userId);
    
    // 尝试读取现有用户
    const existingUser = await fileStorageService.readJson<User | null>(userId, 'user.json');
    
    const now = new Date().toISOString();
    
    if (existingUser) {
      // 更新用户信息
      const updatedUser: User = {
        ...existingUser,
        name: feishuUser.name,
        avatar: feishuUser.avatar_url,
        updatedAt: now,
      };
      await fileStorageService.writeJson(userId, 'user.json', updatedUser);
      return updatedUser;
    }
    
    // 创建新用户
    const newUser: User = {
      id: uuidv4(),
      feishuUserId: userId,
      name: feishuUser.name,
      avatar: feishuUser.avatar_url,
      createdAt: now,
      updatedAt: now,
    };
    
    await fileStorageService.writeJson(userId, 'user.json', newUser);
    return newUser;
  }

  /**
   * 生成 JWT 令牌
   */
  generateToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      feishuUserId: user.feishuUserId,
      name: user.name,
    };
    
    // 7 天过期时间（秒）
    const expiresInSeconds = 7 * 24 * 60 * 60;
    
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: expiresInSeconds,
    });
  }

  /**
   * 验证 JWT 令牌
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('TOKEN_EXPIRED: JWT 令牌已过期');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('TOKEN_INVALID: JWT 令牌无效');
      }
      throw error;
    }
  }

  /**
   * 刷新 JWT 令牌
   */
  async refreshToken(token: string): Promise<string> {
    const payload = this.verifyToken(token);
    
    // 读取用户信息
    const user = await fileStorageService.readJson<User | null>(
      payload.feishuUserId, 
      'user.json'
    );
    
    if (!user) {
      throw new Error('TOKEN_INVALID: 用户不存在');
    }
    
    return this.generateToken(user);
  }
}

// 导出单例
export const authService = new AuthService();
