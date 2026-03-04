/**
 * 配置管理模块
 * 从环境变量加载飞书应用凭证、多维表格 ID 等配置
 * 
 * 验证: 需求 7.2 - 支持通过环境变量配置飞书应用凭证、多维表格 ID 等参数
 */

import { WebhookServerConfig, BitableConfig } from '../types/feishu';

/**
 * 应用配置接口
 */
export interface AppConfig {
  /** Webhook 服务器配置 */
  server: WebhookServerConfig;
  /** 多维表格配置 */
  bitable: BitableConfig;
  /** 项目名称字段名 */
  projectNameFieldName: string;
  /** 运行环境 */
  nodeEnv: string;
}

/**
 * 配置验证错误
 */
export class ConfigValidationError extends Error {
  constructor(missingKeys: string[]) {
    super(`缺少必需的环境变量: ${missingKeys.join(', ')}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * 必需的环境变量列表
 */
const REQUIRED_ENV_VARS = [
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_VERIFICATION_TOKEN',
  'BITABLE_APP_TOKEN',
  'INTERPRETATION_TABLE_ID',
  'TRANSLATION_TABLE_ID',
];

/**
 * 验证必需的环境变量是否存在
 * @throws ConfigValidationError 如果缺少必需的环境变量
 */
export function validateConfig(): void {
  const missingKeys: string[] = [];
  
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missingKeys.push(key);
    }
  }
  
  if (missingKeys.length > 0) {
    throw new ConfigValidationError(missingKeys);
  }
}

/**
 * 从环境变量加载配置
 * @param validate 是否验证配置（默认为 true）
 * @returns 应用配置
 * @throws ConfigValidationError 如果验证失败且 validate 为 true
 */
export function loadConfig(validate: boolean = true): AppConfig {
  if (validate) {
    validateConfig();
  }
  
  return {
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      feishuAppId: process.env.FEISHU_APP_ID || '',
      feishuAppSecret: process.env.FEISHU_APP_SECRET || '',
      verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || '',
      encryptKey: process.env.FEISHU_ENCRYPT_KEY || '',
    },
    bitable: {
      appToken: process.env.BITABLE_APP_TOKEN || '',
      interpretationTableId: process.env.INTERPRETATION_TABLE_ID || '',
      translationTableId: process.env.TRANSLATION_TABLE_ID || '',
      statusFieldName: process.env.STATUS_FIELD_NAME || '承接进度',
      workhourFieldName: process.env.WORKHOUR_FIELD_NAME || '工时统计/min',
    },
    projectNameFieldName: process.env.PROJECT_NAME_FIELD_NAME || '项目名称',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

/**
 * 获取默认配置（用于测试）
 * @returns 默认配置
 */
export function getDefaultConfig(): AppConfig {
  return {
    server: {
      port: 3000,
      feishuAppId: 'test_app_id',
      feishuAppSecret: 'test_app_secret',
      verificationToken: 'test_verification_token',
      encryptKey: 'test_encrypt_key',
    },
    bitable: {
      appToken: 'test_app_token',
      interpretationTableId: 'test_interpretation_table_id',
      translationTableId: 'test_translation_table_id',
      statusFieldName: '承接进度',
      workhourFieldName: '工时统计/min',
    },
    projectNameFieldName: '项目名称',
    nodeEnv: 'test',
  };
}
