/**
 * TrackerService 单元测试
 * 验证工时数据服务的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TrackerService } from '../../src/services/TrackerService';

describe('TrackerService', () => {
  const testDataPath = path.join(__dirname, 'test-tracker-data.json');
  let service: TrackerService;

  beforeEach(async () => {
    // 创建新的服务实例，使用测试数据文件
    service = new TrackerService(testDataPath);
    // 清空测试数据
    await service.clearAllData();
  });

  afterEach(async () => {
    // 清理测试数据文件
    try {
      await fs.unlink(testDataPath);
    } catch {
      // 文件可能不存在，忽略错误
    }
  });

  describe('addTimeRecord', () => {
    it('应该成功添加工时记录', async () => {
      const record = {
        translatorId: 'translator_001',
        translatorName: '张三',
        projectId: 'proj_001',
        projectName: '项目A',
        type: 'interpretation' as const,
        time: 120,
        date: new Date().toISOString(),
      };

      const result = await service.addTimeRecord(record);

      expect(result).toMatchObject(record);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
    });

    it('应该持久化工时记录到文件', async () => {
      const record = {
        translatorId: 'translator_001',
        translatorName: '张三',
        projectId: 'proj_001',
        projectName: '项目A',
        type: 'translation' as const,
        time: 60,
        date: new Date().toISOString(),
      };

      await service.addTimeRecord(record);

      // 重新加载数据验证持久化
      await service.reload();
      const records = await service.getAllTimeRecords();

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject(record);
    });
  });

  describe('findOrCreateTranslator', () => {
    it('应该创建新译员记录', async () => {
      const openId = 'ou_test_001';
      const name = '李四';

      const translator = await service.findOrCreateTranslator(openId, name);

      expect(translator.feishuOpenId).toBe(openId);
      expect(translator.name).toBe(name);
      expect(translator.id).toContain('translator_');
    });

    it('应该返回已存在的译员记录', async () => {
      const openId = 'ou_test_002';
      const name = '王五';

      // 第一次创建
      const first = await service.findOrCreateTranslator(openId, name);
      // 第二次查找
      const second = await service.findOrCreateTranslator(openId, '新名字');

      expect(second.id).toBe(first.id);
      expect(second.name).toBe(name); // 名字不应该被更新
    });

    it('应该持久化译员记录', async () => {
      const openId = 'ou_test_003';
      const name = '赵六';

      await service.findOrCreateTranslator(openId, name);

      // 重新加载数据验证持久化
      await service.reload();
      const translator = await service.findTranslatorByOpenId(openId);

      expect(translator).toBeDefined();
      expect(translator?.name).toBe(name);
    });
  });

  describe('getProjectTotalTime', () => {
    it('应该正确计算项目总工时', async () => {
      const projectId = 'proj_001';

      // 添加多条工时记录
      await service.addTimeRecord({
        translatorId: 'translator_001',
        translatorName: '张三',
        projectId,
        projectName: '项目A',
        type: 'interpretation',
        time: 60,
        date: new Date().toISOString(),
      });

      await service.addTimeRecord({
        translatorId: 'translator_002',
        translatorName: '李四',
        projectId,
        projectName: '项目A',
        type: 'translation',
        time: 90,
        date: new Date().toISOString(),
      });

      await service.addTimeRecord({
        translatorId: 'translator_001',
        translatorName: '张三',
        projectId,
        projectName: '项目A',
        type: 'interpretation',
        time: 30,
        date: new Date().toISOString(),
      });

      const totalTime = await service.getProjectTotalTime(projectId);

      expect(totalTime).toBe(180); // 60 + 90 + 30
    });

    it('应该只计算指定项目的工时', async () => {
      // 添加不同项目的工时记录
      await service.addTimeRecord({
        translatorId: 'translator_001',
        translatorName: '张三',
        projectId: 'proj_001',
        projectName: '项目A',
        type: 'interpretation',
        time: 60,
        date: new Date().toISOString(),
      });

      await service.addTimeRecord({
        translatorId: 'translator_001',
        translatorName: '张三',
        projectId: 'proj_002',
        projectName: '项目B',
        type: 'translation',
        time: 120,
        date: new Date().toISOString(),
      });

      const totalTimeA = await service.getProjectTotalTime('proj_001');
      const totalTimeB = await service.getProjectTotalTime('proj_002');

      expect(totalTimeA).toBe(60);
      expect(totalTimeB).toBe(120);
    });

    it('应该返回 0 当项目没有工时记录', async () => {
      const totalTime = await service.getProjectTotalTime('non_existent_project');

      expect(totalTime).toBe(0);
    });
  });

  describe('getAllTimeRecords', () => {
    it('应该返回所有工时记录', async () => {
      await service.addTimeRecord({
        translatorId: 'translator_001',
        translatorName: '张三',
        projectId: 'proj_001',
        projectName: '项目A',
        type: 'interpretation',
        time: 60,
        date: new Date().toISOString(),
      });

      await service.addTimeRecord({
        translatorId: 'translator_002',
        translatorName: '李四',
        projectId: 'proj_002',
        projectName: '项目B',
        type: 'translation',
        time: 90,
        date: new Date().toISOString(),
      });

      const records = await service.getAllTimeRecords();

      expect(records).toHaveLength(2);
    });

    it('应该返回空数组当没有记录', async () => {
      const records = await service.getAllTimeRecords();

      expect(records).toEqual([]);
    });
  });
});
