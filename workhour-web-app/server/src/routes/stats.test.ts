import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createStatsRouter } from './stats';

function createMockTrackerService() {
  return {
    getAllTimeRecords: vi.fn(),
  };
}

const mockUser = {
  userId: 'translator_123',
  feishuOpenId: 'ou_abc',
  name: '张三',
};

function createApp(trackerService: any) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = mockUser as any;
    next();
  });
  app.use('/api/stats', createStatsRouter(trackerService));
  return app;
}

const sampleRecords = [
  { id: 1, translatorId: 't1', translatorName: '张三', projectId: 'p1', projectName: '口译A', type: 'interpretation', time: 60, date: '2024-01-10T10:00:00.000Z' },
  { id: 2, translatorId: 't1', translatorName: '张三', projectId: 'p2', projectName: '笔译B', type: 'translation', time: 30, date: '2024-01-15T10:00:00.000Z' },
  { id: 3, translatorId: 't2', translatorName: '李四', projectId: 'p1', projectName: '口译A', type: 'interpretation', time: 45, date: '2024-02-20T10:00:00.000Z' },
  { id: 4, translatorId: 't2', translatorName: '李四', projectId: 'p3', projectName: '笔译C', type: 'translation', time: 90, date: '2024-03-05T10:00:00.000Z' },
];

describe('Stats Routes', () => {
  let mockTracker: ReturnType<typeof createMockTrackerService>;

  beforeEach(() => {
    mockTracker = createMockTrackerService();
  });

  describe('GET /api/stats', () => {
    it('should return correct aggregate stats for all records', async () => {
      mockTracker.getAllTimeRecords.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { data } = res.body;
      expect(data.totalTime).toBe(225);
      expect(data.interpretationTime).toBe(105);
      expect(data.translationTime).toBe(120);
      expect(data.translatorCount).toBe(2);
    });

    it('should group by translator correctly', async () => {
      mockTracker.getAllTimeRecords.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats');

      const { byTranslator } = res.body.data;
      expect(byTranslator).toHaveLength(2);

      const zhangsan = byTranslator.find((t: any) => t.name === '张三');
      expect(zhangsan.totalTime).toBe(90);
      expect(zhangsan.interpretationTime).toBe(60);
      expect(zhangsan.translationTime).toBe(30);

      const lisi = byTranslator.find((t: any) => t.name === '李四');
      expect(lisi.totalTime).toBe(135);
      expect(lisi.interpretationTime).toBe(45);
      expect(lisi.translationTime).toBe(90);
    });

    it('should group by project correctly', async () => {
      mockTracker.getAllTimeRecords.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats');

      const { byProject } = res.body.data;
      expect(byProject).toHaveLength(3);

      const projA = byProject.find((p: any) => p.name === '口译A');
      expect(projA.totalTime).toBe(105);
      expect(projA.type).toBe('interpretation');

      const projB = byProject.find((p: any) => p.name === '笔译B');
      expect(projB.totalTime).toBe(30);

      const projC = byProject.find((p: any) => p.name === '笔译C');
      expect(projC.totalTime).toBe(90);
    });

    it('should filter by startDate', async () => {
      mockTracker.getAllTimeRecords.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats?startDate=2024-02-01');

      expect(res.status).toBe(200);
      const { data } = res.body;
      // Only records from 2024-02-20 and 2024-03-05
      expect(data.totalTime).toBe(135);
      expect(data.translatorCount).toBe(1);
    });

    it('should filter by endDate', async () => {
      mockTracker.getAllTimeRecords.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats?endDate=2024-01-31');

      expect(res.status).toBe(200);
      const { data } = res.body;
      // Only records from 2024-01-10 and 2024-01-15
      expect(data.totalTime).toBe(90);
      expect(data.translatorCount).toBe(1);
    });

    it('should filter by both startDate and endDate', async () => {
      mockTracker.getAllTimeRecords.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats?startDate=2024-01-12&endDate=2024-02-28');

      expect(res.status).toBe(200);
      const { data } = res.body;
      // Records from 2024-01-15 and 2024-02-20
      expect(data.totalTime).toBe(75);
      expect(data.translatorCount).toBe(2);
    });

    it('should return zeros when no records exist', async () => {
      mockTracker.getAllTimeRecords.mockResolvedValue([]);

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats');

      expect(res.status).toBe(200);
      const { data } = res.body;
      expect(data.totalTime).toBe(0);
      expect(data.interpretationTime).toBe(0);
      expect(data.translationTime).toBe(0);
      expect(data.translatorCount).toBe(0);
      expect(data.byTranslator).toHaveLength(0);
      expect(data.byProject).toHaveLength(0);
    });

    it('should return 500 when TrackerService throws', async () => {
      mockTracker.getAllTimeRecords.mockRejectedValue(new Error('read error'));

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: '获取统计数据失败' });
    });
  });

  describe('Unified JSON response format (Req 8.10)', () => {
    it('success responses have success: true and data field', async () => {
      mockTracker.getAllTimeRecords.mockResolvedValue([]);

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats');

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.error).toBeUndefined();
    });

    it('error responses have success: false and error field', async () => {
      mockTracker.getAllTimeRecords.mockRejectedValue(new Error('fail'));

      const app = createApp(mockTracker);
      const res = await request(app).get('/api/stats');

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });
  });
});
