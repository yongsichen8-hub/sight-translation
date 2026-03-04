/**
 * Webhook 服务器
 * 接收飞书事件回调的后端服务，负责业务逻辑处理
 * 
 * 验证: 需求 7.1 - 提供 HTTP POST 接口用于接收飞书事件订阅回调
 * 验证: 需求 7.2 - 支持通过环境变量配置
 * 验证: 需求 7.4 - 将运行日志输出到控制台
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { EventHandler, EventHandlerConfig, EventHandlerDependencies } from './handlers/EventHandler';
import { EventCallbackRequest, CardAction } from './types/feishu';
import { AppConfig } from './config';

/**
 * Webhook 服务器类
 */
export class WebhookServer {
  private app: Express;
  private config: AppConfig;
  private eventHandler: EventHandler;
  private server: ReturnType<Express['listen']> | null = null;

  /**
   * 构造函数
   * @param config 应用配置
   * @param deps 事件处理器依赖
   */
  constructor(config: AppConfig, deps: EventHandlerDependencies) {
    this.config = config;
    this.app = express();
    
    // 创建事件处理器配置
    const eventHandlerConfig: EventHandlerConfig = {
      verificationToken: config.server.verificationToken,
      encryptKey: config.server.encryptKey,
      appId: config.server.feishuAppId,
      appSecret: config.server.feishuAppSecret,
    };
    
    this.eventHandler = new EventHandler(eventHandlerConfig, deps);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 配置中间件
   */
  private setupMiddleware(): void {
    // JSON 解析中间件
    this.app.use(express.json());
    
    // 请求日志中间件
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * 配置路由
   */
  private setupRoutes(): void {
    // 健康检查路由
    this.app.get('/health', this.handleHealth.bind(this));
    
    // 飞书事件订阅回调路由
    this.app.post('/webhook/event', this.handleEvent.bind(this));
    
    // 飞书卡片交互回调路由
    this.app.post('/webhook/card', this.handleCard.bind(this));
  }

  /**
   * 健康检查处理
   * 
   * @param _req 请求对象
   * @param res 响应对象
   */
  private handleHealth(_req: Request, res: Response): void {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: this.config.nodeEnv,
    });
  }


  /**
   * 飞书事件订阅回调处理
   * 
   * 验证: 需求 7.1 - 提供 HTTP POST 接口用于接收飞书事件订阅回调
   * 验证: 需求 7.3 - 支持飞书事件订阅的 URL 验证（Challenge 验证）机制
   * 验证: 需求 1.3 - 3 秒内完成响应，返回 HTTP 200 状态码
   * 验证: 需求 1.4 - 重复事件 ID 被忽略
   * 验证: 需求 1.5 - 签名验证失败返回 HTTP 403
   * 
   * @param req 请求对象
   * @param res 响应对象
   */
  private async handleEvent(req: Request, res: Response): Promise<void> {
    const body = req.body as EventCallbackRequest;
    const timestamp = new Date().toISOString();

    // 处理 Challenge 验证（URL 验证）
    if (body.type === 'url_verification' && body.challenge) {
      console.log(`[${timestamp}] Challenge 验证请求`);
      const response = this.eventHandler.handleChallenge(body.challenge);
      res.json(response);
      return;
    }

    // 验证请求签名
    const signature = req.headers['x-lark-signature'] as string || '';
    const requestTimestamp = req.headers['x-lark-request-timestamp'] as string || '';
    const nonce = req.headers['x-lark-request-nonce'] as string || '';
    const bodyStr = JSON.stringify(req.body);

    if (!this.eventHandler.verifySignature(requestTimestamp, nonce, bodyStr, signature)) {
      console.error(`[${timestamp}] 签名验证失败`);
      res.status(403).json({ error: '签名验证失败' });
      return;
    }

    // 提取事件 ID
    const eventId = body.header?.event_id || body.event?.event_id || '';

    // 检查重复事件
    if (eventId && this.eventHandler.isDuplicateEvent(eventId)) {
      console.log(`[${timestamp}] 重复事件已忽略: ${eventId}`);
      res.status(200).json({ message: 'ok' });
      return;
    }

    // 立即返回 200 响应，确保在 3 秒内响应
    res.status(200).json({ message: 'ok' });

    // 异步处理消息事件
    if (body.event) {
      const eventType = body.header?.event_type || body.event.event_type;
      console.log(`[${timestamp}] 处理事件: ${eventType}, event_id: ${eventId}`);

      try {
        await this.eventHandler.handleMessageEvent(body.event);
        console.log(`[${timestamp}] 事件处理完成: ${eventId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${timestamp}] 事件处理失败: ${eventId}, 错误: ${errorMessage}`);
      }
    }
  }

  /**
   * 飞书卡片交互回调处理
   * 
   * @param req 请求对象
   * @param res 响应对象
   */
  private async handleCard(req: Request, res: Response): Promise<void> {
    const action = req.body as CardAction;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] 卡片交互回调: user=${action.open_id}, action=${action.action?.tag}`);

    try {
      const response = await this.eventHandler.handleCardAction(action);
      res.json(response);
      console.log(`[${timestamp}] 卡片交互处理完成`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${timestamp}] 卡片交互处理失败: ${errorMessage}`);
      res.status(500).json({
        toast: {
          type: 'error',
          content: '处理失败，请稍后重试',
        },
      });
    }
  }

  /**
   * 启动服务器
   * @returns Promise
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.server.port, () => {
        console.log(`[${new Date().toISOString()}] Webhook 服务器已启动`);
        console.log(`  - 端口: ${this.config.server.port}`);
        console.log(`  - 环境: ${this.config.nodeEnv}`);
        console.log(`  - 事件回调: POST /webhook/event`);
        console.log(`  - 卡片回调: POST /webhook/card`);
        console.log(`  - 健康检查: GET /health`);
        resolve();
      });
    });
  }

  /**
   * 停止服务器
   * @returns Promise
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: Error | undefined) => {
          if (err) {
            reject(err);
          } else {
            console.log(`[${new Date().toISOString()}] Webhook 服务器已停止`);
            this.server = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 获取 Express 应用实例（用于测试）
   * @returns Express 应用实例
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * 获取事件处理器（用于测试）
   * @returns 事件处理器实例
   */
  getEventHandler(): EventHandler {
    return this.eventHandler;
  }
}

/**
 * 创建 WebhookServer 实例的工厂函数
 * @param config 应用配置
 * @param deps 事件处理器依赖
 * @returns WebhookServer 实例
 */
export function createWebhookServer(
  config: AppConfig,
  deps: EventHandlerDependencies
): WebhookServer {
  return new WebhookServer(config, deps);
}
