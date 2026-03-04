/**
 * 飞书工时机器人 - 主入口
 * 组装所有服务组件，启动 Webhook 服务器
 * 
 * 验证: 需求 1.1 - 机器人消息监听与问卷触发
 * 验证: 需求 2.1 - 动态读取进行中的项目列表
 * 验证: 需求 4.1 - 工时数据录入本地追踪平台
 * 验证: 需求 5.1 - 工时汇总回写飞书多维表格
 */

import { loadConfig, AppConfig } from './config';
import { WebhookServer } from './server';
import { EventHandlerDependencies } from './handlers/EventHandler';
import { BitableService } from './services/BitableService';
import { TrackerService } from './services/TrackerService';
import { CardBuilder } from './services/CardBuilder';
import { UserService } from './services/UserService';

/**
 * 创建服务依赖
 * 实现依赖注入，连接所有服务组件
 * 
 * @param config 应用配置
 * @returns 事件处理器依赖对象
 */
function createDependencies(config: AppConfig): EventHandlerDependencies {
  // 创建 BitableService - 飞书多维表格服务
  const bitableService = new BitableService(
    config.server.feishuAppId,
    config.server.feishuAppSecret,
    config.bitable
  );

  // 创建 TrackerService - 本地工时数据服务
  const trackerService = new TrackerService();

  // 创建 CardBuilder - 卡片构建器
  const cardBuilder = new CardBuilder();

  // 创建 UserService - 用户身份识别服务
  const userService = new UserService(
    config.server.feishuAppId,
    config.server.feishuAppSecret
  );

  return {
    bitableService,
    trackerService,
    cardBuilder,
    userService,
  };
}

/**
 * 主函数
 * 加载配置、创建服务实例、启动服务器
 */
async function main(): Promise<void> {
  console.log('========================================');
  console.log('  飞书工时机器人 - Feishu Workhour Bot');
  console.log('========================================');
  console.log();

  try {
    // 1. 加载配置
    console.log('[启动] 加载配置...');
    const config = loadConfig();
    console.log('[启动] 配置加载成功');
    console.log(`  - 环境: ${config.nodeEnv}`);
    console.log(`  - 端口: ${config.server.port}`);
    console.log(`  - 多维表格: ${config.bitable.appToken}`);

    // 2. 创建服务依赖
    console.log('[启动] 创建服务组件...');
    const dependencies = createDependencies(config);
    console.log('[启动] 服务组件创建成功');
    console.log('  - BitableService: 飞书多维表格服务');
    console.log('  - TrackerService: 本地工时数据服务');
    console.log('  - CardBuilder: 卡片构建器');
    console.log('  - UserService: 用户身份识别服务');

    // 3. 创建并启动 Webhook 服务器
    console.log('[启动] 启动 Webhook 服务器...');
    const server = new WebhookServer(config, dependencies);
    await server.start();

    console.log();
    console.log('========================================');
    console.log('  服务器已就绪，等待飞书事件回调...');
    console.log('========================================');

    // 4. 优雅关闭处理
    const shutdown = async (signal: string) => {
      console.log();
      console.log(`[关闭] 收到 ${signal} 信号，正在关闭服务器...`);
      try {
        await server.stop();
        console.log('[关闭] 服务器已安全关闭');
        process.exit(0);
      } catch (error) {
        console.error('[关闭] 关闭服务器时发生错误:', error);
        process.exit(1);
      }
    };

    // 监听进程信号
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[错误] 启动失败:', errorMessage);
    
    if (error instanceof Error && error.name === 'ConfigValidationError') {
      console.error();
      console.error('请确保已正确配置以下环境变量:');
      console.error('  - FEISHU_APP_ID: 飞书应用 App ID');
      console.error('  - FEISHU_APP_SECRET: 飞书应用 App Secret');
      console.error('  - FEISHU_VERIFICATION_TOKEN: 飞书验证 Token');
      console.error('  - BITABLE_APP_TOKEN: 多维表格 App Token');
      console.error('  - PROJECT_TABLE_ID: 项目管理表 ID');
      console.error('  - WORKHOUR_TABLE_ID: 工时统计表 ID');
      console.error();
      console.error('可参考 .env.example 文件进行配置');
    }
    
    process.exit(1);
  }
}

// 启动应用
main();
