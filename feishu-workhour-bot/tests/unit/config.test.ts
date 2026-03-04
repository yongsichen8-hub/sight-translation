/**
 * 配置管理模块单元测试
 * 
 * 验证: 需求 7.2 - 支持通过环境变量配置飞书应用凭证、多维表格 ID 等参数
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadConfig,
  validateConfig,
  getDefaultConfig,
  ConfigValidationError,
  AppConfig,
} from '../../src/config';

describe('Config Module', () => {
  // 保存原始环境变量
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 清理环境变量
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;
    delete process.env.FEISHU_VERIFICATION_TOKEN;
    delete process.env.FEISHU_ENCRYPT_KEY;
    delete process.env.BITABLE_APP_TOKEN;
    delete process.env.INTERPRETATION_TABLE_ID;
    delete process.env.TRANSLATION_TABLE_ID;
    delete process.env.STATUS_FIELD_NAME;
    delete process.env.WORKHOUR_FIELD_NAME;
    delete process.env.PROJECT_NAME_FIELD_NAME;
    delete process.env.PORT;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = { ...originalEnv };
  });

  describe('validateConfig', () => {
    it('should throw ConfigValidationError when required env vars are missing', () => {
      expect(() => validateConfig()).toThrow(ConfigValidationError);
    });

    it('should throw error with list of missing keys', () => {
      try {
        validateConfig();
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as Error).message).toContain('FEISHU_APP_ID');
        expect((error as Error).message).toContain('FEISHU_APP_SECRET');
      }
    });

    it('should not throw when all required env vars are present', () => {
      process.env.FEISHU_APP_ID = 'test_app_id';
      process.env.FEISHU_APP_SECRET = 'test_secret';
      process.env.FEISHU_VERIFICATION_TOKEN = 'test_token';
      process.env.BITABLE_APP_TOKEN = 'test_bitable_token';
      process.env.INTERPRETATION_TABLE_ID = 'test_interpretation_table';
      process.env.TRANSLATION_TABLE_ID = 'test_translation_table';

      expect(() => validateConfig()).not.toThrow();
    });
  });

  describe('loadConfig', () => {
    it('should load config from environment variables', () => {
      process.env.FEISHU_APP_ID = 'cli_test123';
      process.env.FEISHU_APP_SECRET = 'secret123';
      process.env.FEISHU_VERIFICATION_TOKEN = 'token123';
      process.env.FEISHU_ENCRYPT_KEY = 'encrypt123';
      process.env.BITABLE_APP_TOKEN = 'app_token123';
      process.env.INTERPRETATION_TABLE_ID = 'tbl_interpretation123';
      process.env.TRANSLATION_TABLE_ID = 'tbl_translation123';
      process.env.STATUS_FIELD_NAME = '承接进度';
      process.env.WORKHOUR_FIELD_NAME = '工时/min';
      process.env.PROJECT_NAME_FIELD_NAME = '项目';
      process.env.PORT = '8080';
      process.env.NODE_ENV = 'production';

      const config = loadConfig();

      expect(config.server.feishuAppId).toBe('cli_test123');
      expect(config.server.feishuAppSecret).toBe('secret123');
      expect(config.server.verificationToken).toBe('token123');
      expect(config.server.encryptKey).toBe('encrypt123');
      expect(config.server.port).toBe(8080);
      expect(config.bitable.appToken).toBe('app_token123');
      expect(config.bitable.interpretationTableId).toBe('tbl_interpretation123');
      expect(config.bitable.translationTableId).toBe('tbl_translation123');
      expect(config.bitable.statusFieldName).toBe('承接进度');
      expect(config.bitable.workhourFieldName).toBe('工时/min');
      expect(config.projectNameFieldName).toBe('项目');
      expect(config.nodeEnv).toBe('production');
    });

    it('should use default values for optional env vars', () => {
      process.env.FEISHU_APP_ID = 'test_app_id';
      process.env.FEISHU_APP_SECRET = 'test_secret';
      process.env.FEISHU_VERIFICATION_TOKEN = 'test_token';
      process.env.BITABLE_APP_TOKEN = 'test_bitable_token';
      process.env.INTERPRETATION_TABLE_ID = 'test_interpretation_table';
      process.env.TRANSLATION_TABLE_ID = 'test_translation_table';

      const config = loadConfig();

      expect(config.server.port).toBe(3000);
      expect(config.server.encryptKey).toBe('');
      expect(config.bitable.statusFieldName).toBe('承接进度');
      expect(config.bitable.workhourFieldName).toBe('工时统计/min');
      expect(config.projectNameFieldName).toBe('项目名称');
      expect(config.nodeEnv).toBe('development');
    });

    it('should skip validation when validate=false', () => {
      const config = loadConfig(false);

      expect(config.server.feishuAppId).toBe('');
      expect(config.server.feishuAppSecret).toBe('');
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default test configuration', () => {
      const config = getDefaultConfig();

      expect(config.server.port).toBe(3000);
      expect(config.server.feishuAppId).toBe('test_app_id');
      expect(config.server.feishuAppSecret).toBe('test_app_secret');
      expect(config.server.verificationToken).toBe('test_verification_token');
      expect(config.server.encryptKey).toBe('test_encrypt_key');
      expect(config.bitable.appToken).toBe('test_app_token');
      expect(config.bitable.interpretationTableId).toBe('test_interpretation_table_id');
      expect(config.bitable.translationTableId).toBe('test_translation_table_id');
      expect(config.bitable.statusFieldName).toBe('承接进度');
      expect(config.bitable.workhourFieldName).toBe('工时统计/min');
      expect(config.projectNameFieldName).toBe('项目名称');
      expect(config.nodeEnv).toBe('test');
    });
  });
});
