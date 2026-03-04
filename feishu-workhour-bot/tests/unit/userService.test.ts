/**
 * UserService 单元测试
 * 
 * 验证: 需求 6.1 - 从飞书消息事件中提取发送者的 open_id 和用户名
 * 验证: 需求 6.4 - 调用飞书用户信息 API 获取用户的真实姓名
 * 验证: 需求 6.5 - 获取飞书用户信息失败时使用 open_id 作为译员姓名的备用值
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserService } from '../../src/services/UserService';

// Mock @larksuiteoapi/node-sdk
vi.mock('@larksuiteoapi/node-sdk', () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      contact: {
        user: {
          get: vi.fn(),
        },
      },
    })),
    AppType: {
      SelfBuild: 'self_build',
    },
    Domain: {
      Feishu: 'feishu',
    },
  };
});

describe('UserService', () => {
  let userService: UserService;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();
    
    // 创建 UserService 实例
    userService = new UserService('test_app_id', 'test_app_secret');
    
    // 获取 mock 的 get 方法
    mockGet = (userService as any).client.contact.user.get;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserInfo', () => {
    it('应该成功获取用户信息', async () => {
      // 模拟成功的 API 响应
      mockGet.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          user: {
            open_id: 'ou_test123',
            user_id: 'user_test456',
            name: '张三',
            avatar: {
              avatar_240: 'https://example.com/avatar.png',
            },
          },
        },
      });

      const result = await userService.getUserInfo('ou_test123');

      expect(result).toEqual({
        open_id: 'ou_test123',
        user_id: 'user_test456',
        name: '张三',
        avatar_url: 'https://example.com/avatar.png',
      });

      // 验证 API 调用参数
      expect(mockGet).toHaveBeenCalledWith({
        path: {
          user_id: 'ou_test123',
        },
        params: {
          user_id_type: 'open_id',
        },
      });
    });

    it('应该在 API 返回错误码时使用 open_id 作为备用姓名', async () => {
      // 模拟 API 返回错误
      mockGet.mockResolvedValue({
        code: 99991663,
        msg: 'user not found',
        data: null,
      });

      const result = await userService.getUserInfo('ou_unknown');

      expect(result).toEqual({
        open_id: 'ou_unknown',
        name: 'ou_unknown',
      });
    });

    it('应该在 API 响应为空时使用 open_id 作为备用姓名', async () => {
      // 模拟 API 返回空数据
      mockGet.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {},
      });

      const result = await userService.getUserInfo('ou_empty');

      expect(result).toEqual({
        open_id: 'ou_empty',
        name: 'ou_empty',
      });
    });

    it('应该在 API 调用异常时使用 open_id 作为备用姓名', async () => {
      // 模拟 API 调用抛出异常
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await userService.getUserInfo('ou_error');

      expect(result).toEqual({
        open_id: 'ou_error',
        name: 'ou_error',
      });
    });

    it('应该在用户没有姓名时使用 open_id 作为备用', async () => {
      // 模拟用户没有姓名的情况
      mockGet.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          user: {
            open_id: 'ou_noname',
            user_id: 'user_noname',
            // name 字段缺失
            avatar: {
              avatar_origin: 'https://example.com/origin.png',
            },
          },
        },
      });

      const result = await userService.getUserInfo('ou_noname');

      expect(result).toEqual({
        open_id: 'ou_noname',
        user_id: 'user_noname',
        name: 'ou_noname', // 使用 open_id 作为备用
        avatar_url: 'https://example.com/origin.png',
      });
    });

    it('应该优先使用 avatar_240 作为头像 URL', async () => {
      mockGet.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          user: {
            open_id: 'ou_avatar',
            name: '李四',
            avatar: {
              avatar_72: 'https://example.com/72.png',
              avatar_240: 'https://example.com/240.png',
              avatar_640: 'https://example.com/640.png',
              avatar_origin: 'https://example.com/origin.png',
            },
          },
        },
      });

      const result = await userService.getUserInfo('ou_avatar');

      expect(result.avatar_url).toBe('https://example.com/240.png');
    });

    it('应该在没有 avatar_240 时使用 avatar_origin', async () => {
      mockGet.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          user: {
            open_id: 'ou_avatar2',
            name: '王五',
            avatar: {
              avatar_origin: 'https://example.com/origin.png',
            },
          },
        },
      });

      const result = await userService.getUserInfo('ou_avatar2');

      expect(result.avatar_url).toBe('https://example.com/origin.png');
    });

    it('应该在没有头像信息时返回 undefined', async () => {
      mockGet.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          user: {
            open_id: 'ou_noavatar',
            name: '赵六',
          },
        },
      });

      const result = await userService.getUserInfo('ou_noavatar');

      expect(result.avatar_url).toBeUndefined();
    });
  });
});
