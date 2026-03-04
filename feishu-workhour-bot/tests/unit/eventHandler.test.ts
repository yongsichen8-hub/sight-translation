/**
 * EventHandler 单元测试
 * 
 * 测试事件处理器的核心功能：
 * - Challenge 验证
 * - 签名验证
 * - 事件去重
 * - 关键词检测
 * - 消息事件处理
 * - 卡片回调处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventHandler, EventHandlerConfig, EventHandlerDependencies } from '../../src/handlers/EventHandler';
import { CardBuilder } from '../../src/services/CardBuilder';
import { MessageEvent, CardAction } from '../../src/types/feishu';

// Mock 依赖服务
const mockCardBuilder = {
  buildWorkhourCard: vi.fn(),
  buildSuccessCard: vi.fn(),
  buildErrorCard: vi.fn(),
};

const mockBitableService = {
  getOngoingProjects: vi.fn(),
  updateWorkhourStats: vi.fn(),
  findOrCreateWorkhourRecord: vi.fn(),
};

const mockTrackerService = {
  addTimeRecord: vi.fn(),
  findOrCreateTranslator: vi.fn(),
  getProjectTotalTime: vi.fn(),
};

const mockUserService = {
  getUserInfo: vi.fn(),
};

// Mock lark SDK
vi.mock('@larksuiteoapi/node-sdk', () => ({
  Client: vi.fn().mockImplementation(() => ({
    im: {
      message: {
        create: vi.fn().mockResolvedValue({ code: 0 }),
      },
    },
  })),
  AppType: { SelfBuild: 'self_build' },
  Domain: { Feishu: 'feishu' },
}));

describe('EventHandler', () => {
  let eventHandler: EventHandler;
  const config: EventHandlerConfig = {
    verificationToken: 'test-token',
    encryptKey: 'test-encrypt-key',
    appId: 'test-app-id',
    appSecret: 'test-app-secret',
  };

  const deps: EventHandlerDependencies = {
    cardBuilder: mockCardBuilder as unknown as CardBuilder,
    bitableService: mockBitableService as any,
    trackerService: mockTrackerService as any,
    userService: mockUserService as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    eventHandler = new EventHandler(config, deps);
  });


  describe('handleChallenge', () => {
    /**
     * 验证: 需求 7.3 - 支持飞书事件订阅的 URL 验证（Challenge 验证）机制
     * Property 15: Challenge 验证响应
     */
    it('should return the same challenge value', () => {
      const challenge = 'test-challenge-string';
      const response = eventHandler.handleChallenge(challenge);
      expect(response).toEqual({ challenge });
    });

    it('should handle empty challenge', () => {
      const response = eventHandler.handleChallenge('');
      expect(response).toEqual({ challenge: '' });
    });

    it('should handle special characters in challenge', () => {
      const challenge = 'test-challenge-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const response = eventHandler.handleChallenge(challenge);
      expect(response).toEqual({ challenge });
    });
  });

  describe('verifySignature', () => {
    /**
     * 验证: 需求 1.5 - 验证飞书请求签名，签名验证失败返回 HTTP 403
     * Property 3: 签名验证安全性
     */
    it('should return true for valid signature', () => {
      const crypto = require('crypto');
      const timestamp = '1234567890';
      const nonce = 'test-nonce';
      const body = '{"test": "data"}';
      
      // 计算正确的签名
      const content = timestamp + nonce + config.encryptKey + body;
      const expectedSignature = crypto.createHash('sha256').update(content).digest('hex');
      
      const result = eventHandler.verifySignature(timestamp, nonce, body, expectedSignature);
      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const timestamp = '1234567890';
      const nonce = 'test-nonce';
      const body = '{"test": "data"}';
      const invalidSignature = 'invalid-signature';
      
      const result = eventHandler.verifySignature(timestamp, nonce, body, invalidSignature);
      expect(result).toBe(false);
    });

    it('should return true when encryptKey is not configured', () => {
      const configWithoutEncryptKey: EventHandlerConfig = {
        ...config,
        encryptKey: undefined,
      };
      const handlerWithoutEncryptKey = new EventHandler(configWithoutEncryptKey, deps);
      
      const result = handlerWithoutEncryptKey.verifySignature('ts', 'nonce', 'body', 'any-sig');
      expect(result).toBe(true);
    });
  });

  describe('isDuplicateEvent', () => {
    /**
     * 验证: 需求 1.4 - 重复的事件 ID 被忽略
     * Property 2: 事件去重幂等性
     */
    it('should return false for first occurrence of event', () => {
      const eventId = 'event-001';
      const result = eventHandler.isDuplicateEvent(eventId);
      expect(result).toBe(false);
    });

    it('should return true for duplicate event', () => {
      const eventId = 'event-002';
      
      // 第一次处理
      eventHandler.isDuplicateEvent(eventId);
      
      // 第二次处理应该返回 true
      const result = eventHandler.isDuplicateEvent(eventId);
      expect(result).toBe(true);
    });

    it('should handle multiple different events', () => {
      const eventId1 = 'event-003';
      const eventId2 = 'event-004';
      
      expect(eventHandler.isDuplicateEvent(eventId1)).toBe(false);
      expect(eventHandler.isDuplicateEvent(eventId2)).toBe(false);
      expect(eventHandler.isDuplicateEvent(eventId1)).toBe(true);
      expect(eventHandler.isDuplicateEvent(eventId2)).toBe(true);
    });

    it('should track processed event count', () => {
      eventHandler.clearEventCache();
      expect(eventHandler.getProcessedEventCount()).toBe(0);
      
      eventHandler.isDuplicateEvent('event-005');
      expect(eventHandler.getProcessedEventCount()).toBe(1);
      
      eventHandler.isDuplicateEvent('event-006');
      expect(eventHandler.getProcessedEventCount()).toBe(2);
    });
  });

  describe('containsWorkhourKeyword', () => {
    /**
     * 验证: 需求 1.1, 1.2 - 关键词触发
     * Property 1: 关键词触发卡片推送
     */
    it('should return true when message contains "工时"', () => {
      expect(eventHandler.containsWorkhourKeyword('工时')).toBe(true);
      expect(eventHandler.containsWorkhourKeyword('填报工时')).toBe(true);
      expect(eventHandler.containsWorkhourKeyword('我要填工时')).toBe(true);
      expect(eventHandler.containsWorkhourKeyword('工时填报')).toBe(true);
    });

    it('should return false when message does not contain "工时"', () => {
      expect(eventHandler.containsWorkhourKeyword('你好')).toBe(false);
      expect(eventHandler.containsWorkhourKeyword('hello')).toBe(false);
      expect(eventHandler.containsWorkhourKeyword('')).toBe(false);
      expect(eventHandler.containsWorkhourKeyword('工作时间')).toBe(false);
    });
  });


  describe('handleMessageEvent', () => {
    /**
     * 验证: 需求 1.1 - 包含"工时"关键词的消息触发工时填报卡片
     * 验证: 需求 1.2 - 不包含"工时"关键词的消息回复提示消息
     */
    const createMessageEvent = (text: string): MessageEvent => ({
      event_id: 'evt-test-001',
      event_type: 'im.message.receive_v1',
      sender: {
        open_id: 'ou_test_user',
      },
      message: {
        chat_id: 'oc_test_chat',
        content: JSON.stringify({ text }),
        message_type: 'text',
      },
    });

    it('should send workhour card when message contains keyword', async () => {
      const mockProjects = [
        { recordId: 'rec_001', name: '项目A', status: '进行中' },
      ];
      mockBitableService.getOngoingProjects.mockResolvedValue(mockProjects);
      mockCardBuilder.buildWorkhourCard.mockReturnValue({ config: {}, header: {}, elements: [] });

      const event = createMessageEvent('我要填工时');
      await eventHandler.handleMessageEvent(event);

      expect(mockBitableService.getOngoingProjects).toHaveBeenCalled();
      expect(mockCardBuilder.buildWorkhourCard).toHaveBeenCalledWith(mockProjects);
    });

    it('should send hint message when message does not contain keyword', async () => {
      const event = createMessageEvent('你好');
      await eventHandler.handleMessageEvent(event);

      // 不应该调用获取项目列表
      expect(mockBitableService.getOngoingProjects).not.toHaveBeenCalled();
    });

    it('should send hint when no ongoing projects', async () => {
      mockBitableService.getOngoingProjects.mockResolvedValue([]);

      const event = createMessageEvent('工时');
      await eventHandler.handleMessageEvent(event);

      expect(mockBitableService.getOngoingProjects).toHaveBeenCalled();
      expect(mockCardBuilder.buildWorkhourCard).not.toHaveBeenCalled();
    });
  });

  describe('handleCardAction', () => {
    /**
     * 验证: 需求 3.6 - 取消按钮关闭卡片
     */
    it('should handle cancel action', async () => {
      const action: CardAction = {
        open_id: 'ou_test_user',
        action: {
          tag: 'button',
          value: { action: 'cancel' },
        },
      };

      const response = await eventHandler.handleCardAction(action);
      
      expect(response.toast?.type).toBe('info');
      expect(response.toast?.content).toBe('已取消填报');
    });

    /**
     * 验证: 需求 3.2, 3.3, 3.4, 3.5 - 表单验证
     */
    it('should reject empty form submission', async () => {
      const action: CardAction = {
        open_id: 'ou_test_user',
        action: {
          tag: 'button',
          value: { action: 'submit' },
        },
      };

      const response = await eventHandler.handleCardAction(action);
      
      expect(response.toast?.type).toBe('error');
    });

    it('should reject invalid time format', async () => {
      const action: CardAction = {
        open_id: 'ou_test_user',
        action: {
          tag: 'button',
          value: {
            action: 'submit',
            interpretation_project: 'proj_001',
            interpretation_time: 'abc', // 非数字
          },
        },
      };

      const response = await eventHandler.handleCardAction(action);
      
      expect(response.toast?.type).toBe('error');
    });

    it('should reject project without time', async () => {
      const action: CardAction = {
        open_id: 'ou_test_user',
        action: {
          tag: 'button',
          value: {
            action: 'submit',
            interpretation_project: 'proj_001',
            // 缺少 interpretation_time
          },
        },
      };

      const response = await eventHandler.handleCardAction(action);
      
      expect(response.toast?.type).toBe('error');
    });

    it('should reject time without project', async () => {
      const action: CardAction = {
        open_id: 'ou_test_user',
        action: {
          tag: 'button',
          value: {
            action: 'submit',
            interpretation_time: '60',
            // 缺少 interpretation_project
          },
        },
      };

      const response = await eventHandler.handleCardAction(action);
      
      expect(response.toast?.type).toBe('error');
    });

    /**
     * 验证: 需求 4.1 - 将工时记录写入 Tracker
     * 验证: 需求 5.1, 5.2 - 计算并更新工时统计
     */
    it('should process valid form submission', async () => {
      const mockProjects = [
        { recordId: 'proj_001', name: '项目A', status: '进行中' },
      ];
      mockBitableService.getOngoingProjects.mockResolvedValue(mockProjects);
      mockUserService.getUserInfo.mockResolvedValue({
        open_id: 'ou_test_user',
        name: '测试用户',
      });
      mockTrackerService.findOrCreateTranslator.mockResolvedValue({
        id: 'translator_001',
        name: '测试用户',
        feishuOpenId: 'ou_test_user',
      });
      mockTrackerService.addTimeRecord.mockResolvedValue({});
      mockTrackerService.getProjectTotalTime.mockResolvedValue(120);
      mockBitableService.updateWorkhourStats.mockResolvedValue(undefined);
      mockCardBuilder.buildSuccessCard.mockReturnValue({ config: {}, header: {}, elements: [] });

      const action: CardAction = {
        open_id: 'ou_test_user',
        action: {
          tag: 'button',
          value: {
            action: 'submit',
            interpretation_project: 'proj_001',
            interpretation_time: '60',
          },
        },
      };

      const response = await eventHandler.handleCardAction(action);
      
      expect(response.toast?.type).toBe('success');
      expect(mockTrackerService.addTimeRecord).toHaveBeenCalled();
      expect(mockBitableService.updateWorkhourStats).toHaveBeenCalled();
    });

    /**
     * 验证: 需求 4.4 - 如果本地 Tracker 写入失败，不执行多维表格回写
     * 验证: 需求 5.4 - 如果本地 Tracker 写入失败，不执行多维表格工时统计更新
     * Property 11: 写入失败阻断回写
     */
    describe('Tracker write failure blocking', () => {
      it('should NOT call BitableService when TrackerService.addTimeRecord fails for interpretation', async () => {
        const mockProjects = [
          { recordId: 'proj_001', name: '项目A', status: '进行中' },
        ];
        mockBitableService.getOngoingProjects.mockResolvedValue(mockProjects);
        mockUserService.getUserInfo.mockResolvedValue({
          open_id: 'ou_test_user',
          name: '测试用户',
        });
        mockTrackerService.findOrCreateTranslator.mockResolvedValue({
          id: 'translator_001',
          name: '测试用户',
          feishuOpenId: 'ou_test_user',
        });
        // Tracker 写入失败
        mockTrackerService.addTimeRecord.mockRejectedValue(new Error('Tracker write failed'));

        const action: CardAction = {
          open_id: 'ou_test_user',
          action: {
            tag: 'button',
            value: {
              action: 'submit',
              interpretation_project: 'proj_001',
              interpretation_time: '60',
            },
          },
        };

        const response = await eventHandler.handleCardAction(action);
        
        // 应该返回错误
        expect(response.toast?.type).toBe('error');
        expect(response.toast?.content).toContain('工时记录保存失败');
        
        // 关键验证：BitableService 不应该被调用
        expect(mockBitableService.updateWorkhourStats).not.toHaveBeenCalled();
        expect(mockTrackerService.getProjectTotalTime).not.toHaveBeenCalled();
      });

      it('should NOT call BitableService when TrackerService.addTimeRecord fails for translation', async () => {
        const mockProjects = [
          { recordId: 'proj_002', name: '项目B', status: '进行中' },
        ];
        mockBitableService.getOngoingProjects.mockResolvedValue(mockProjects);
        mockUserService.getUserInfo.mockResolvedValue({
          open_id: 'ou_test_user',
          name: '测试用户',
        });
        mockTrackerService.findOrCreateTranslator.mockResolvedValue({
          id: 'translator_001',
          name: '测试用户',
          feishuOpenId: 'ou_test_user',
        });
        // Tracker 写入失败
        mockTrackerService.addTimeRecord.mockRejectedValue(new Error('File I/O error'));

        const action: CardAction = {
          open_id: 'ou_test_user',
          action: {
            tag: 'button',
            value: {
              action: 'submit',
              translation_project: 'proj_002',
              translation_time: '90',
            },
          },
        };

        const response = await eventHandler.handleCardAction(action);
        
        // 应该返回错误
        expect(response.toast?.type).toBe('error');
        expect(response.toast?.content).toContain('工时记录保存失败');
        
        // 关键验证：BitableService 不应该被调用
        expect(mockBitableService.updateWorkhourStats).not.toHaveBeenCalled();
      });

      it('should NOT update Bitable for second project when first Tracker write fails', async () => {
        const mockProjects = [
          { recordId: 'proj_001', name: '项目A', status: '进行中' },
          { recordId: 'proj_002', name: '项目B', status: '进行中' },
        ];
        mockBitableService.getOngoingProjects.mockResolvedValue(mockProjects);
        mockUserService.getUserInfo.mockResolvedValue({
          open_id: 'ou_test_user',
          name: '测试用户',
        });
        mockTrackerService.findOrCreateTranslator.mockResolvedValue({
          id: 'translator_001',
          name: '测试用户',
          feishuOpenId: 'ou_test_user',
        });
        // 第一次 Tracker 写入失败
        mockTrackerService.addTimeRecord.mockRejectedValue(new Error('Disk full'));

        const action: CardAction = {
          open_id: 'ou_test_user',
          action: {
            tag: 'button',
            value: {
              action: 'submit',
              interpretation_project: 'proj_001',
              interpretation_time: '60',
              translation_project: 'proj_002',
              translation_time: '90',
            },
          },
        };

        const response = await eventHandler.handleCardAction(action);
        
        // 应该返回错误
        expect(response.toast?.type).toBe('error');
        
        // 关键验证：BitableService 不应该被调用（即使有两个项目）
        expect(mockBitableService.updateWorkhourStats).not.toHaveBeenCalled();
      });

      it('should return warning when Tracker succeeds but Bitable update fails', async () => {
        const mockProjects = [
          { recordId: 'proj_001', name: '项目A', status: '进行中' },
        ];
        mockBitableService.getOngoingProjects.mockResolvedValue(mockProjects);
        mockUserService.getUserInfo.mockResolvedValue({
          open_id: 'ou_test_user',
          name: '测试用户',
        });
        mockTrackerService.findOrCreateTranslator.mockResolvedValue({
          id: 'translator_001',
          name: '测试用户',
          feishuOpenId: 'ou_test_user',
        });
        // Tracker 写入成功
        mockTrackerService.addTimeRecord.mockResolvedValue({});
        mockTrackerService.getProjectTotalTime.mockResolvedValue(120);
        // Bitable 更新失败
        mockBitableService.updateWorkhourStats.mockRejectedValue(new Error('API error'));
        mockCardBuilder.buildSuccessCard.mockReturnValue({ config: {}, header: {}, elements: [] });

        const action: CardAction = {
          open_id: 'ou_test_user',
          action: {
            tag: 'button',
            value: {
              action: 'submit',
              interpretation_project: 'proj_001',
              interpretation_time: '60',
            },
          },
        };

        const response = await eventHandler.handleCardAction(action);
        
        // 应该返回警告（本地已保存但同步失败）
        expect(response.toast?.type).toBe('warning');
        expect(response.toast?.content).toContain('本地记录已保存');
        expect(response.toast?.content).toContain('飞书表格同步失败');
        
        // Tracker 应该被调用
        expect(mockTrackerService.addTimeRecord).toHaveBeenCalled();
        // Bitable 也应该被调用（尝试更新）
        expect(mockBitableService.updateWorkhourStats).toHaveBeenCalled();
      });

      it('should log error when Tracker write fails', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        const mockProjects = [
          { recordId: 'proj_001', name: '项目A', status: '进行中' },
        ];
        mockBitableService.getOngoingProjects.mockResolvedValue(mockProjects);
        mockUserService.getUserInfo.mockResolvedValue({
          open_id: 'ou_test_user',
          name: '测试用户',
        });
        mockTrackerService.findOrCreateTranslator.mockResolvedValue({
          id: 'translator_001',
          name: '测试用户',
          feishuOpenId: 'ou_test_user',
        });
        mockTrackerService.addTimeRecord.mockRejectedValue(new Error('Write error'));

        const action: CardAction = {
          open_id: 'ou_test_user',
          action: {
            tag: 'button',
            value: {
              action: 'submit',
              interpretation_project: 'proj_001',
              interpretation_time: '60',
            },
          },
        };

        await eventHandler.handleCardAction(action);
        
        // 验证错误日志被记录
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[Tracker写入失败]'),
          expect.objectContaining({
            openId: 'ou_test_user',
            projectId: 'proj_001',
          })
        );
        
        consoleSpy.mockRestore();
      });
    });
  });
});
