/**
 * 事件处理器
 * 处理飞书事件回调，包括消息事件和卡片交互事件
 * 
 * 验证: 需求 1.1 - 包含"工时"关键词的消息触发工时填报卡片
 * 验证: 需求 1.2 - 不包含"工时"关键词的消息回复提示消息
 * 验证: 需求 1.3 - 3 秒内完成响应
 * 验证: 需求 1.4 - 重复事件 ID 被忽略
 * 验证: 需求 1.5 - 签名验证失败返回 HTTP 403
 * 验证: 需求 7.3 - 支持 Challenge 验证机制
 */

import * as crypto from 'crypto';
import * as lark from '@larksuiteoapi/node-sdk';
import {
  MessageEvent,
  CardAction,
  CardActionResponse,
  ChallengeResponse,
  InteractiveCard,
} from '../types/feishu';
import { Project, SubmitSummary } from '../types';
import { CardBuilder } from '../services/CardBuilder';
import { BitableService } from '../services/BitableService';
import { TrackerService } from '../services/TrackerService';
import { UserService } from '../services/UserService';
import { validateWorkhourForm, WorkhourFormData } from '../validators/FormValidator';

/**
 * 工时关键词
 */
const WORKHOUR_KEYWORD = '工时';

/**
 * 事件处理器配置
 */
export interface EventHandlerConfig {
  /** 验证 Token */
  verificationToken: string;
  /** 加密 Key（可选，用于加密模式） */
  encryptKey?: string;
  /** 飞书 App ID */
  appId: string;
  /** 飞书 App Secret */
  appSecret: string;
}

/**
 * 事件处理器依赖
 */
export interface EventHandlerDependencies {
  cardBuilder: CardBuilder;
  bitableService: BitableService;
  trackerService: TrackerService;
  userService: UserService;
}

/**
 * EventHandler 类
 * 处理飞书事件回调
 */
export class EventHandler {
  private config: EventHandlerConfig;
  private deps: EventHandlerDependencies;
  private client: lark.Client;
  
  /**
   * 已处理的事件 ID 缓存（用于去重）
   * 使用 Map 存储事件 ID 和处理时间，便于清理过期事件
   */
  private processedEvents: Map<string, number> = new Map();
  
  /**
   * 事件缓存过期时间（毫秒）- 5 分钟
   */
  private readonly EVENT_CACHE_TTL = 5 * 60 * 1000;

  /**
   * 构造函数
   * @param config 事件处理器配置
   * @param deps 依赖服务
   */
  constructor(config: EventHandlerConfig, deps: EventHandlerDependencies) {
    this.config = config;
    this.deps = deps;
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
  }


  /**
   * 处理 Challenge 验证
   * 飞书事件订阅的 URL 验证机制
   * 
   * Property 15: Challenge 验证响应
   * 对于任意 Challenge 验证请求，系统应在响应体中返回相同的 challenge 值
   * 
   * 验证: 需求 7.3 - 支持飞书事件订阅的 URL 验证（Challenge 验证）机制
   * 
   * @param challenge Challenge 字符串
   * @returns Challenge 响应
   */
  handleChallenge(challenge: string): ChallengeResponse {
    return { challenge };
  }

  /**
   * 验证请求签名
   * 
   * Property 3: 签名验证安全性
   * 对于任意请求，当请求签名与预期不匹配时，系统应返回 HTTP 403 状态码并拒绝处理
   * 
   * 验证: 需求 1.5 - 验证飞书请求签名，签名验证失败返回 HTTP 403
   * 
   * @param timestamp 请求时间戳
   * @param nonce 随机字符串
   * @param body 请求体字符串
   * @param signature 请求签名
   * @returns 签名是否有效
   */
  verifySignature(timestamp: string, nonce: string, body: string, signature: string): boolean {
    // 如果没有配置 encryptKey，跳过签名验证
    if (!this.config.encryptKey) {
      return true;
    }

    // 按照飞书签名算法计算签名
    // signature = sha256(timestamp + nonce + encryptKey + body)
    const content = timestamp + nonce + this.config.encryptKey + body;
    const expectedSignature = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * 检查事件是否重复
   * 
   * Property 2: 事件去重幂等性
   * 对于任意事件 ID，当系统收到相同 event_id 的重复事件时，
   * 第二次及后续请求应被忽略，不产生重复的业务处理
   * 
   * 验证: 需求 1.4 - 重复的事件 ID 被忽略
   * 
   * @param eventId 事件 ID
   * @returns 是否为重复事件
   */
  isDuplicateEvent(eventId: string): boolean {
    // 清理过期的事件缓存
    this.cleanExpiredEvents();
    
    // 检查事件是否已处理
    if (this.processedEvents.has(eventId)) {
      return true;
    }
    
    // 记录事件 ID
    this.processedEvents.set(eventId, Date.now());
    return false;
  }

  /**
   * 清理过期的事件缓存
   */
  private cleanExpiredEvents(): void {
    const now = Date.now();
    for (const [eventId, timestamp] of this.processedEvents.entries()) {
      if (now - timestamp > this.EVENT_CACHE_TTL) {
        this.processedEvents.delete(eventId);
      }
    }
  }

  /**
   * 检查消息是否包含工时关键词
   * 
   * Property 1: 关键词触发卡片推送
   * 对于任意包含"工时"关键词的消息内容，系统应触发工时填报卡片推送；
   * 对于任意不包含"工时"关键词的消息内容，系统应返回提示消息而非卡片
   * 
   * @param content 消息内容
   * @returns 是否包含工时关键词
   */
  containsWorkhourKeyword(content: string): boolean {
    return content.includes(WORKHOUR_KEYWORD);
  }


  /**
   * 处理消息事件
   * 
   * Property 1: 关键词触发卡片推送
   * 验证: 需求 1.1 - 包含"工时"关键词的消息触发工时填报卡片
   * 验证: 需求 1.2 - 不包含"工时"关键词的消息回复提示消息
   * 验证: 需求 1.3 - 3 秒内完成响应
   * 
   * @param event 消息事件
   */
  async handleMessageEvent(event: MessageEvent): Promise<void> {
    const { sender, message } = event;
    const openId = sender.open_id;
    const chatId = message.chat_id;

    // 解析消息内容
    let textContent = '';
    try {
      if (message.message_type === 'text') {
        const contentObj = JSON.parse(message.content);
        textContent = contentObj.text || '';
      }
    } catch (error) {
      console.error('解析消息内容失败:', error);
      textContent = message.content;
    }

    // 检查是否包含工时关键词
    if (this.containsWorkhourKeyword(textContent)) {
      // 触发工时填报卡片
      await this.sendWorkhourCard(chatId, openId);
    } else {
      // 发送提示消息
      await this.sendHintMessage(chatId);
    }
  }

  /**
   * 发送工时填报卡片
   * 
   * 验证: 需求 1.1 - 回复工时填报互动卡片
   * 验证: 需求 2.1 - 从 Project_Table 中读取进行中的项目
   * 验证: 需求 2.3 - 无进行中项目时发送提示消息
   * 
   * @param chatId 会话 ID
   * @param openId 用户 open_id
   */
  private async sendWorkhourCard(chatId: string, openId: string): Promise<void> {
    try {
      // 获取进行中的项目列表
      const projects = await this.deps.bitableService.getOngoingProjects();

      // 检查是否有进行中的项目
      if (projects.length === 0) {
        await this.sendTextMessage(chatId, '当前无可填报的进行中项目，请联系管理员添加项目。');
        return;
      }

      // 构建工时填报卡片
      const card = this.deps.cardBuilder.buildWorkhourCard(projects);

      // 发送卡片消息
      await this.sendCardMessage(chatId, card);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('发送工时填报卡片失败:', errorMessage);
      
      // 发送错误提示
      await this.sendTextMessage(chatId, '获取项目列表失败，请稍后重试。');
    }
  }

  /**
   * 发送提示消息
   * 
   * 验证: 需求 1.2 - 告知用户发送"工时"可触发填报问卷
   * 
   * @param chatId 会话 ID
   */
  private async sendHintMessage(chatId: string): Promise<void> {
    await this.sendTextMessage(
      chatId,
      '您好！发送"工时"可触发工时填报问卷。'
    );
  }

  /**
   * 发送文本消息
   * 
   * @param chatId 会话 ID
   * @param text 消息文本
   */
  private async sendTextMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text }),
        },
      });
    } catch (error) {
      console.error('发送文本消息失败:', error);
    }
  }

  /**
   * 发送卡片消息
   * 
   * @param chatId 会话 ID
   * @param card 互动卡片
   */
  private async sendCardMessage(chatId: string, card: InteractiveCard): Promise<void> {
    try {
      await this.client.im.message.create({
        params: {
          receive_id_type: 'chat_id',
        },
        data: {
          receive_id: chatId,
          msg_type: 'interactive',
          content: JSON.stringify(card),
        },
      });
    } catch (error) {
      console.error('发送卡片消息失败:', error);
    }
  }


  /**
   * 处理卡片交互回调
   * 
   * 验证: 需求 3.2 - 至少填写口译或笔译其中一项
   * 验证: 需求 3.3 - 工时必须为正整数
   * 验证: 需求 3.4, 3.5 - 项目和工时必须配对
   * 验证: 需求 3.6 - 取消按钮关闭卡片
   * 验证: 需求 4.1 - 将工时记录写入 Tracker
   * 验证: 需求 5.1, 5.2 - 计算并更新工时统计
   * 
   * @param action 卡片交互动作
   * @returns 卡片交互响应
   */
  async handleCardAction(action: CardAction): Promise<CardActionResponse> {
    const { open_id: openId, action: actionData, chat_id: chatId } = action;
    const actionValue = actionData.value;

    // 处理取消操作
    if (actionValue.action === 'cancel') {
      return {
        toast: {
          type: 'info',
          content: '已取消填报',
        },
      };
    }

    // 处理提交操作
    if (actionValue.action === 'submit') {
      return await this.handleFormSubmit(openId, actionValue, chatId);
    }

    // 其他操作（如选择项目、输入工时）不需要特殊处理
    return {};
  }

  /**
   * 处理表单提交
   * 
   * Property 11: 写入失败阻断回写
   * 对于任意工时提交，当本地 Tracker 写入失败时，系统不应执行飞书多维表格的回写操作
   * 
   * 验证: 需求 4.4 - 如果本地 Tracker 写入失败，不执行多维表格回写，并向用户发送错误提示
   * 验证: 需求 5.4 - 如果本地 Tracker 写入失败，不执行多维表格工时统计更新
   * 
   * @param openId 用户 open_id
   * @param formData 表单数据
   * @param chatId 会话 ID（可选）
   * @returns 卡片交互响应
   */
  private async handleFormSubmit(
    openId: string,
    formData: Record<string, any>,
    chatId?: string
  ): Promise<CardActionResponse> {
    // 提取表单数据
    const workhourForm: WorkhourFormData = {
      interpretationProject: formData.interpretation_project,
      interpretationTime: formData.interpretation_time,
      translationProject: formData.translation_project,
      translationTime: formData.translation_time,
    };

    // 验证表单
    const validationResult = validateWorkhourForm(workhourForm);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors.map(e => e.message).join('；');
      return {
        toast: {
          type: 'error',
          content: errorMessages,
        },
      };
    }

    // 记录提交摘要
    const summary: SubmitSummary = {
      translatorName: '',
      submitTime: new Date().toLocaleString('zh-CN'),
    };

    // 用于存储需要更新的项目工时信息（在 Tracker 写入成功后使用）
    const projectsToUpdate: Array<{ projectName: string; projectId: string }> = [];

    try {
      // 获取用户信息
      const userInfo = await this.deps.userService.getUserInfo(openId);
      
      // 查找或创建译员
      const translator = await this.deps.trackerService.findOrCreateTranslator(
        openId,
        userInfo.name
      );
      summary.translatorName = translator.name;

      // 获取项目信息（用于记录项目名称）
      const projects = await this.deps.bitableService.getOngoingProjects();
      const projectMap = new Map(projects.map(p => [p.recordId, p]));

      // ========== 阶段 1: 写入本地 Tracker ==========
      // 验证: 需求 4.4, 5.4 - 先写入 Tracker，如果失败则不执行多维表格回写
      
      // 处理口译工时 - 写入 Tracker
      if (workhourForm.interpretationProject && workhourForm.interpretationTime) {
        const project = projectMap.get(workhourForm.interpretationProject);
        const projectName = project?.name || workhourForm.interpretationProject;
        const time = parseInt(String(workhourForm.interpretationTime), 10);

        try {
          await this.deps.trackerService.addTimeRecord({
            translatorId: translator.id,
            translatorName: translator.name,
            projectId: workhourForm.interpretationProject,
            projectName,
            type: 'interpretation',
            time,
            date: new Date().toISOString(),
          });

          // 记录成功写入的项目，稍后更新多维表格
          projectsToUpdate.push({
            projectName,
            projectId: workhourForm.interpretationProject,
          });

          summary.interpretationProject = projectName;
          summary.interpretationTime = time;
        } catch (trackerError) {
          // Tracker 写入失败，记录错误日志并立即返回错误
          const errorMsg = trackerError instanceof Error ? trackerError.message : String(trackerError);
          console.error('[Tracker写入失败] 口译工时写入失败:', {
            openId,
            projectId: workhourForm.interpretationProject,
            projectName,
            time,
            error: errorMsg,
          });

          // 验证: 需求 4.4 - 向用户发送错误提示，不执行后续回写
          return {
            toast: {
              type: 'error',
              content: '工时记录保存失败，请重试',
            },
          };
        }
      }

      // 处理笔译工时 - 写入 Tracker
      if (workhourForm.translationProject && workhourForm.translationTime) {
        const project = projectMap.get(workhourForm.translationProject);
        const projectName = project?.name || workhourForm.translationProject;
        const time = parseInt(String(workhourForm.translationTime), 10);

        try {
          await this.deps.trackerService.addTimeRecord({
            translatorId: translator.id,
            translatorName: translator.name,
            projectId: workhourForm.translationProject,
            projectName,
            type: 'translation',
            time,
            date: new Date().toISOString(),
          });

          // 记录成功写入的项目，稍后更新多维表格
          projectsToUpdate.push({
            projectName,
            projectId: workhourForm.translationProject,
          });

          summary.translationProject = projectName;
          summary.translationTime = time;
        } catch (trackerError) {
          // Tracker 写入失败，记录错误日志并立即返回错误
          const errorMsg = trackerError instanceof Error ? trackerError.message : String(trackerError);
          console.error('[Tracker写入失败] 笔译工时写入失败:', {
            openId,
            projectId: workhourForm.translationProject,
            projectName,
            time,
            error: errorMsg,
          });

          // 验证: 需求 4.4 - 向用户发送错误提示，不执行后续回写
          return {
            toast: {
              type: 'error',
              content: '工时记录保存失败，请重试',
            },
          };
        }
      }

      // ========== 阶段 2: 更新飞书多维表格 ==========
      // 只有在所有 Tracker 写入成功后才执行多维表格更新
      // 验证: 需求 5.1, 5.2 - 计算并更新工时统计
      
      let bitableUpdateFailed = false;
      for (const { projectName, projectId } of projectsToUpdate) {
        try {
          const totalTime = await this.deps.trackerService.getProjectTotalTime(projectId);
          await this.deps.bitableService.updateWorkhourStats(projectName, totalTime);
        } catch (bitableError) {
          // 多维表格更新失败，记录错误但继续处理其他项目
          const errorMsg = bitableError instanceof Error ? bitableError.message : String(bitableError);
          console.error('[多维表格更新失败] 工时统计更新失败:', {
            projectId,
            projectName,
            error: errorMsg,
          });
          bitableUpdateFailed = true;
        }
      }

      // 返回结果
      const successCard = this.deps.cardBuilder.buildSuccessCard(summary);
      
      if (bitableUpdateFailed) {
        // 验证: 需求 5.4 - 告知本地记录已保存但飞书表格同步失败
        return {
          card: successCard,
          toast: {
            type: 'warning',
            content: '本地记录已保存，但飞书表格同步失败',
          },
        };
      }

      return {
        card: successCard,
        toast: {
          type: 'success',
          content: '工时提交成功！',
        },
      };
    } catch (error) {
      // 处理其他未预期的错误（如获取用户信息失败、获取项目列表失败等）
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[表单提交失败] 未预期的错误:', {
        openId,
        error: errorMessage,
      });

      return {
        toast: {
          type: 'error',
          content: '提交失败，请稍后重试',
        },
      };
    }
  }

  /**
   * 清除事件缓存（用于测试）
   */
  clearEventCache(): void {
    this.processedEvents.clear();
  }

  /**
   * 获取已处理事件数量（用于测试）
   */
  getProcessedEventCount(): number {
    return this.processedEvents.size;
  }
}

/**
 * 创建 EventHandler 实例的工厂函数
 * @param config 事件处理器配置
 * @param deps 依赖服务
 * @returns EventHandler 实例
 */
export function createEventHandler(
  config: EventHandlerConfig,
  deps: EventHandlerDependencies
): EventHandler {
  return new EventHandler(config, deps);
}
