/**
 * 用户服务
 * 处理飞书用户身份识别
 * 
 * 验证: 需求 6.1 - 从飞书消息事件中提取发送者的 open_id 和用户名
 * 验证: 需求 6.4 - 调用飞书用户信息 API 获取用户的真实姓名
 * 验证: 需求 6.5 - 获取飞书用户信息失败时使用 open_id 作为译员姓名的备用值
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { FeishuUser } from '../types/index';

/**
 * 飞书用户 API 响应中的用户数据结构
 */
interface FeishuUserApiResponse {
  user?: {
    open_id?: string;
    user_id?: string;
    name?: string;
    avatar?: {
      avatar_72?: string;
      avatar_240?: string;
      avatar_640?: string;
      avatar_origin?: string;
    };
  };
}

/**
 * UserService 类
 * 提供飞书用户信息获取功能
 */
export class UserService {
  private client: lark.Client;

  /**
   * 构造函数
   * @param appId 飞书应用 App ID
   * @param appSecret 飞书应用 App Secret
   */
  constructor(appId: string, appSecret: string) {
    this.client = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
  }

  /**
   * 获取用户信息
   * 调用飞书 API 获取用户的真实姓名和其他信息
   * 
   * 验证: 需求 6.4 - 调用飞书用户信息 API 获取用户的真实姓名
   * 验证: 需求 6.5 - 获取飞书用户信息失败时使用 open_id 作为译员姓名的备用值
   * 
   * @param openId 飞书用户的 open_id
   * @returns 用户信息对象
   */
  async getUserInfo(openId: string): Promise<FeishuUser> {
    try {
      const response = await this.client.contact.user.get({
        path: {
          user_id: openId,
        },
        params: {
          user_id_type: 'open_id',
        },
      });

      if (response.code !== 0) {
        // API 调用返回错误码，使用 open_id 作为备用姓名
        console.error(`获取用户信息失败: ${response.msg} (code: ${response.code})`);
        return this.createFallbackUser(openId);
      }

      const data = response.data as FeishuUserApiResponse | undefined;
      const user = data?.user;

      if (!user) {
        // 响应中没有用户数据，使用 open_id 作为备用姓名
        console.warn(`用户信息响应为空，使用 open_id 作为备用: ${openId}`);
        return this.createFallbackUser(openId);
      }

      return {
        open_id: user.open_id ?? openId,
        user_id: user.user_id,
        name: user.name ?? openId, // 如果没有姓名，使用 open_id 作为备用
        avatar_url: user.avatar?.avatar_240 ?? user.avatar?.avatar_origin,
      };
    } catch (error) {
      // API 调用异常，使用 open_id 作为备用姓名
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`获取用户信息异常: ${errorMessage}`);
      return this.createFallbackUser(openId);
    }
  }

  /**
   * 创建备用用户信息
   * 当 API 调用失败时，使用 open_id 作为用户姓名
   * 
   * 验证: 需求 6.5 - 获取飞书用户信息失败时使用 open_id 作为译员姓名的备用值
   * 
   * @param openId 飞书用户的 open_id
   * @returns 备用用户信息对象
   */
  private createFallbackUser(openId: string): FeishuUser {
    return {
      open_id: openId,
      name: openId, // 使用 open_id 作为备用姓名
    };
  }
}

/**
 * 创建 UserService 实例的工厂函数
 * @param appId 飞书应用 App ID
 * @param appSecret 飞书应用 App Secret
 * @returns UserService 实例
 */
export function createUserService(appId: string, appSecret: string): UserService {
  return new UserService(appId, appSecret);
}
