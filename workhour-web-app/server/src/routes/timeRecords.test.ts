import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTimeRecordsRouter } from './timeRecords';

function createMockTrackerService() {
  return {
    addTimeRecord: vi.fn(),
    getTimeRecordsByTranslator: vi.fn(),
    getProjectTotalTime: vi.fn(),
  };
}

function createMockBitableService() {
  return {
    updateWorkhourStats: vi.fn(),
  };
}

const mockUser = {
  userId: 'translator_123',
  feishuOpenId: 'ou_abc',
  name: '张三',
  avatar: 'https://example.com/avatar.png',
};

function createApp(trackerService: any, bitableService: any) {
  const app = express();
  app.use(express.json());
  // Inject mock user for all requests
  app.use((req, _res, next) => {
    req.user = mockUser as any;
    next();
  });
  app.use('/api/time-records', createTimeRecordsRouter(trackerService, bitableService));
  return app;
}

describe('TimeRecords Routes', () => {
  let mockTracker: ReturnType<typeof createMockTrackerService>;
  let mockBitable: ReturnType<typeof createMockBitableService>;

  beforeEach(() => {
    mockTracker = createMockTrackerService();
    mockBitable = createMockBitableService();
  });

  describe('POST /api/time-records', () => {
    const validEntry = {
      projectId: 'rec001',
      projectName: '口译项目A',
      type: 'interpretation' as const,
      time: 60,
    };

    it('should submit time records successfully', async () => {
      const savedRecord = { id: 1, ...validEntry, translatorId: mockUser.userId, translatorName: mockUser.name, date: '2024-01-15T10:00:00.000Z' };
      mockTracker.addTimeRecord.mockResolvedValue(savedRecord);
      mockTracker.getProjectTotalTime.mockResolvedValue(60);
      mockBitable.updateWorkhourStats.mockResolvedValue(undefined);

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app)
        .post('/api/time-records')
        .send({ entries: [validEntry] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.records).toHaveLength(1);
      expect(res.body.data.syncStatus).toBe('success');
      expect(mockTracker.addTimeRecord).toHaveBeenCalledTimes(1);
      expect(mockBitable.updateWorkhourStats).toHaveBeenCalledWith('口译项目A', 'interpretation', 60, 'rec001');
    });

    it('should return syncStatus partial when Bitable sync fails', async () => {
      const savedRecord = { id: 1, ...validEntry, translatorId: mockUser.userId, translatorName: mockUser.name, date: '2024-01-15T10:00:00.000Z' };
      mockTracker.addTimeRecord.mockResolvedValue(savedRecord);
      mockTracker.getProjectTotalTime.mockResolvedValue(60);
      mockBitable.updateWorkhourStats.mockRejectedValue(new Error('飞书 API 超时'));

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app)
        .post('/api/time-records')
        .send({ entries: [validEntry] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.records).toHaveLength(1);
      expect(res.body.data.syncStatus).toBe('partial');
    });

    it('should handle multiple entries for different projects', async () => {
      const entry2 = { projectId: 'rec002', projectName: '笔译项目B', type: 'translation' as const, time: 30 };
      let callCount = 0;
      mockTracker.addTimeRecord.mockImplementation(async (rec: any) => ({ id: ++callCount, ...rec }));
      mockTracker.getProjectTotalTime.mockResolvedValue(90);
      mockBitable.updateWorkhourStats.mockResolvedValue(undefined);

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app)
        .post('/api/time-records')
        .send({ entries: [validEntry, entry2] });

      expect(res.status).toBe(200);
      expect(res.body.data.records).toHaveLength(2);
      expect(mockTracker.addTimeRecord).toHaveBeenCalledTimes(2);
      // Two different projects → two updateWorkhourStats calls
      expect(mockBitable.updateWorkhourStats).toHaveBeenCalledTimes(2);
    });

    it('should return 400 when entries is missing', async () => {
      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).post('/api/time-records').send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: '请至少填写一条工时记录' });
    });

    it('should return 400 when entries is empty array', async () => {
      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).post('/api/time-records').send({ entries: [] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: '请至少填写一条工时记录' });
    });

    it('should return 400 when entry has invalid time', async () => {
      const app = createApp(mockTracker, mockBitable);
      const res = await request(app)
        .post('/api/time-records')
        .send({ entries: [{ ...validEntry, time: -5 }] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: '工时记录格式不正确' });
    });

    it('should return 400 when entry has invalid type', async () => {
      const app = createApp(mockTracker, mockBitable);
      const res = await request(app)
        .post('/api/time-records')
        .send({ entries: [{ ...validEntry, type: 'invalid' }] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: '项目类型必须为 interpretation 或 translation' });
    });

    it('should return 400 when entry is missing projectId', async () => {
      const app = createApp(mockTracker, mockBitable);
      const res = await request(app)
        .post('/api/time-records')
        .send({ entries: [{ projectName: 'A', type: 'interpretation', time: 10 }] });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: '工时记录格式不正确' });
    });

    it('should return 500 when TrackerService throws', async () => {
      mockTracker.addTimeRecord.mockRejectedValue(new Error('disk full'));

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app)
        .post('/api/time-records')
        .send({ entries: [validEntry] });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: '提交工时失败' });
    });
  });

  describe('GET /api/time-records', () => {
    const sampleRecords = [
      { id: 1, translatorId: 'translator_123', translatorName: '张三', projectId: 'rec001', projectName: '项目A', type: 'interpretation', time: 60, date: '2024-01-15T10:00:00.000Z' },
      { id: 2, translatorId: 'translator_123', translatorName: '张三', projectId: 'rec002', projectName: '项目B', type: 'translation', time: 30, date: '2024-02-20T14:00:00.000Z' },
    ];

    it('should return all records for current user', async () => {
      mockTracker.getTimeRecordsByTranslator.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).get('/api/time-records');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(mockTracker.getTimeRecordsByTranslator).toHaveBeenCalledWith('translator_123');
    });

    it('should filter by projectId', async () => {
      mockTracker.getTimeRecordsByTranslator.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).get('/api/time-records?projectId=rec001');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].projectId).toBe('rec001');
    });

    it('should filter by startDate', async () => {
      mockTracker.getTimeRecordsByTranslator.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).get('/api/time-records?startDate=2024-02-01');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].projectName).toBe('项目B');
    });

    it('should filter by endDate', async () => {
      mockTracker.getTimeRecordsByTranslator.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).get('/api/time-records?endDate=2024-01-31');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].projectName).toBe('项目A');
    });

    it('should combine multiple filters', async () => {
      mockTracker.getTimeRecordsByTranslator.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).get('/api/time-records?projectId=rec001&startDate=2024-01-01&endDate=2024-12-31');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].projectId).toBe('rec001');
    });

    it('should return empty array when no records match filters', async () => {
      mockTracker.getTimeRecordsByTranslator.mockResolvedValue(sampleRecords);

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).get('/api/time-records?projectId=nonexistent');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return 500 when TrackerService throws', async () => {
      mockTracker.getTimeRecordsByTranslator.mockRejectedValue(new Error('read error'));

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).get('/api/time-records');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: '查询工时记录失败' });
    });
  });

  describe('Unified JSON response format (Req 8.10)', () => {
    it('success responses have success: true and data field', async () => {
      mockTracker.getTimeRecordsByTranslator.mockResolvedValue([]);

      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).get('/api/time-records');

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.error).toBeUndefined();
    });

    it('error responses have success: false and error field', async () => {
      const app = createApp(mockTracker, mockBitable);
      const res = await request(app).post('/api/time-records').send({});

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });
  });
});
