/**
 * 飞书 user_access_token 存储与刷新
 * 
 * user_access_token 有效期约 2 小时
 * refresh_token 有效期约 30 天
 * 每次使用前自动刷新
 */

import axios from 'axios';
import { config } from '../config/index';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp in ms
}

// 内存存储（生产环境应使用 Redis）
const tokenMap = new Map<string, TokenData>();

/**
 * 保存用户 token（在 OAuth 回调时调用）
 */
export function saveUserToken(
  feishuOpenId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number // seconds
): void {
  tokenMap.set(feishuOpenId, {
    accessToken,
    refreshToken,
    // 提前 5 分钟过期，避免边界情况
    expiresAt: Date.now() + (expiresIn - 300) * 1000,
  });
}

/**
 * 获取有效的 user_access_token
 * 如果已过期，自动用 refresh_token 刷新
 */
export async function getUserAccessToken(feishuOpenId: string): Promise<string> {
  const data = tokenMap.get(feishuOpenId);
  if (!data) {
    console.error('[TokenStore] No token found for user:', feishuOpenId);
    console.error('[TokenStore] Known users:', [...tokenMap.keys()]);
    throw new Error('TOKEN_NOT_FOUND: 用户 token 不存在，请重新登录');
  }

  // 还没过期，直接返回
  if (Date.now() < data.expiresAt) {
    console.log('[TokenStore] Token valid for user:', feishuOpenId);
    return data.accessToken;
  }

  console.log('[TokenStore] Token expired, refreshing for user:', feishuOpenId);

  // 过期了，用 refresh_token 刷新
  try {
    // 先获取 app_access_token
    const appTokenRes = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
      { app_id: config.FEISHU_APP_ID, app_secret: config.FEISHU_APP_SECRET }
    );
    if (appTokenRes.data.code !== 0) {
      throw new Error(`获取 app_access_token 失败: ${appTokenRes.data.msg}`);
    }

    // 用 refresh_token 刷新
    const refreshRes = await axios.post(
      'https://open.feishu.cn/open-apis/authen/v1/oidc/refresh_access_token',
      {
        grant_type: 'refresh_token',
        refresh_token: data.refreshToken,
      },
      {
        headers: { Authorization: `Bearer ${appTokenRes.data.app_access_token}` },
      }
    );

    if (refreshRes.data.code !== 0) {
      // refresh_token 也过期了，需要重新登录
      tokenMap.delete(feishuOpenId);
      throw new Error('REFRESH_EXPIRED: refresh_token 已过期，请重新登录');
    }

    const newData = refreshRes.data.data;
    const newAccessToken = newData.access_token;
    const newRefreshToken = newData.refresh_token;
    const newExpiresIn = newData.expires_in || 7200;

    // 更新存储
    tokenMap.set(feishuOpenId, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: Date.now() + (newExpiresIn - 300) * 1000,
    });

    return newAccessToken;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('REFRESH_EXPIRED')) {
      throw error;
    }
    throw new Error('TOKEN_REFRESH_FAILED: 刷新 token 失败，请重新登录');
  }
}

/**
 * 删除用户 token（退出登录时调用）
 */
export function removeUserToken(feishuOpenId: string): void {
  tokenMap.delete(feishuOpenId);
}
