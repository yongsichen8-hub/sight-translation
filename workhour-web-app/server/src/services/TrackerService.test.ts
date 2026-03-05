import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TrackerService } from './TrackerService';

describe('TrackerService - Filter & Stats Methods', () => {
  let service: TrackerService;
  let tmpFile: string;

  beforeEach(async () => {
    tmpFile = path.join(os.tmpdir(), `tracker-test-${Date.now()}.json`);
    service = new TrackerService(tmpFile);
    await service.clearAllData();
  });

  afterEach(async () => {
    try { await fs.unlink(tmpFile); } catch {}
  });

  async function seedRecords() {
    await service.addTimeRecord({ translatorId: 't1', translatorName: '张三', projectId: 'p1', projectName: '口译A', type: 'interpretation', time: 60, date: '2024-01-10T10:00:00.000Z' });
    await service.addTimeRecord({ translatorId: 't1', translatorName: '张三', projectId: 'p2', projectName: '笔译B', type: 'translation', time: 30, date: '2024-01-15T10:00:00.000Z' });
    await service.addTimeRecord({ translatorId: 't2', translatorName: '李四', projectId: 'p1', projectName: '口译A', type: 'interpretation', time: 45, date: '2024-02-20T10:00:00.000Z' });
    await service.addTimeRecord({ translatorId: 't2', translatorName: '李四', projectId: 'p3', projectName: '笔译C', type: 'translation', time: 90, date: '2024-03-05T10:00:00.000Z' });
  }

  describe('getTimeRecordsByDateRange', () => {
    it('should return records within the date range (inclusive)', async () => {
      await seedRecords();
      const records = await service.getTimeRecordsByDateRange('2024-01-10', '2024-01-31');
      expect(records).toHaveLength(2);
      expect(records.every(r => r.date >= '2024-01-10' && r.date <= '2024-01-31')).toBe(true);
    });

    it('should return empty array when no records match', async () => {
      await seedRecords();
      const records = await service.getTimeRecordsByDateRange('2025-01-01', '2025-12-31');
      expect(records).toHaveLength(0);
    });

    it('should return all records when range covers everything', async () => {
      await seedRecords();
      const records = await service.getTimeRecordsByDateRange('2020-01-01', '2030-12-31');
      expect(records).toHaveLength(4);
    });
  });

  describe('queryTimeRecords', () => {
    it('should filter by translatorId', async () => {
      await seedRecords();
      const records = await service.queryTimeRecords({ translatorId: 't1' });
      expect(records).toHaveLength(2);
      expect(records.every(r => r.translatorId === 't1')).toBe(true);
    });

    it('should filter by projectId', async () => {
      await seedRecords();
      const records = await service.queryTimeRecords({ projectId: 'p1' });
      expect(records).toHaveLength(2);
      expect(records.every(r => r.projectId === 'p1')).toBe(true);
    });

    it('should filter by date range', async () => {
      await seedRecords();
      const records = await service.queryTimeRecords({ startDate: '2024-02-01', endDate: '2024-02-28' });
      expect(records).toHaveLength(1);
      expect(records[0].translatorName).toBe('李四');
    });

    it('should combine multiple filters', async () => {
      await seedRecords();
      const records = await service.queryTimeRecords({ translatorId: 't2', projectId: 'p1' });
      expect(records).toHaveLength(1);
      expect(records[0].translatorName).toBe('李四');
      expect(records[0].projectName).toBe('口译A');
    });

    it('should return all records when no filters provided', async () => {
      await seedRecords();
      const records = await service.queryTimeRecords({});
      expect(records).toHaveLength(4);
    });

    it('should return empty array when no records match combined filters', async () => {
      await seedRecords();
      const records = await service.queryTimeRecords({ translatorId: 't1', projectId: 'p3' });
      expect(records).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct aggregate stats', async () => {
      await seedRecords();
      const stats = await service.getStats();
      expect(stats.totalTime).toBe(225);
      expect(stats.interpretationTime).toBe(105);
      expect(stats.translationTime).toBe(120);
      expect(stats.translatorCount).toBe(2);
    });

    it('should group by translator correctly', async () => {
      await seedRecords();
      const stats = await service.getStats();
      expect(stats.byTranslator).toHaveLength(2);
      const zhangsan = stats.byTranslator.find(t => t.name === '张三');
      expect(zhangsan!.totalTime).toBe(90);
      expect(zhangsan!.interpretationTime).toBe(60);
      expect(zhangsan!.translationTime).toBe(30);
    });

    it('should group by project correctly', async () => {
      await seedRecords();
      const stats = await service.getStats();
      expect(stats.byProject).toHaveLength(3);
      const projA = stats.byProject.find(p => p.name === '口译A');
      expect(projA!.totalTime).toBe(105);
    });

    it('should filter by date range', async () => {
      await seedRecords();
      const stats = await service.getStats('2024-02-01', '2024-03-31');
      expect(stats.totalTime).toBe(135);
      expect(stats.translatorCount).toBe(1);
    });

    it('should return zeros when no records exist', async () => {
      const stats = await service.getStats();
      expect(stats.totalTime).toBe(0);
      expect(stats.interpretationTime).toBe(0);
      expect(stats.translationTime).toBe(0);
      expect(stats.translatorCount).toBe(0);
      expect(stats.byTranslator).toHaveLength(0);
      expect(stats.byProject).toHaveLength(0);
    });
  });
});
