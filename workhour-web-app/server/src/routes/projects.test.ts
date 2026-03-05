import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createProjectsRouter } from './projects';

function createMockBitableService() {
  return {
    getOngoingProjects: vi.fn(),
    getOngoingProjectsByType: vi.fn(),
    updateWorkhourStats: vi.fn(),
  };
}

function createApp(bitableService: any) {
  const app = express();
  app.use(express.json());
  app.use('/api/projects', createProjectsRouter(bitableService));
  return app;
}

const sampleProjects = [
  { recordId: 'rec1', name: '口译项目A', status: '进行中', projectType: 'interpretation' as const },
  { recordId: 'rec2', name: '笔译项目B', status: '进行中', projectType: 'translation' as const },
  { recordId: 'rec3', name: '口译项目C', status: '进行中', projectType: 'interpretation' as const },
];

describe('Projects Routes', () => {
  let mockBitableService: ReturnType<typeof createMockBitableService>;

  beforeEach(() => {
    mockBitableService = createMockBitableService();
  });

  describe('GET /api/projects', () => {
    it('should return all projects grouped by type', async () => {
      mockBitableService.getOngoingProjects.mockResolvedValue(sampleProjects);

      const app = createApp(mockBitableService);
      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.interpretation).toHaveLength(2);
      expect(res.body.data.translation).toHaveLength(1);
      expect(res.body.data.interpretation[0].name).toBe('口译项目A');
      expect(res.body.data.translation[0].name).toBe('笔译项目B');
    });

    it('should return empty arrays when no projects exist', async () => {
      mockBitableService.getOngoingProjects.mockResolvedValue([]);

      const app = createApp(mockBitableService);
      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { interpretation: [], translation: [] },
      });
    });

    it('should filter by type=interpretation', async () => {
      const interpretationProjects = sampleProjects.filter(p => p.projectType === 'interpretation');
      mockBitableService.getOngoingProjectsByType.mockResolvedValue(interpretationProjects);

      const app = createApp(mockBitableService);
      const res = await request(app).get('/api/projects?type=interpretation');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.interpretation).toHaveLength(2);
      expect(res.body.data.translation).toBeUndefined();
      expect(mockBitableService.getOngoingProjectsByType).toHaveBeenCalledWith('interpretation');
    });

    it('should filter by type=translation', async () => {
      const translationProjects = sampleProjects.filter(p => p.projectType === 'translation');
      mockBitableService.getOngoingProjectsByType.mockResolvedValue(translationProjects);

      const app = createApp(mockBitableService);
      const res = await request(app).get('/api/projects?type=translation');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.translation).toHaveLength(1);
      expect(res.body.data.interpretation).toBeUndefined();
      expect(mockBitableService.getOngoingProjectsByType).toHaveBeenCalledWith('translation');
    });

    it('should ignore invalid type and return all projects', async () => {
      mockBitableService.getOngoingProjects.mockResolvedValue(sampleProjects);

      const app = createApp(mockBitableService);
      const res = await request(app).get('/api/projects?type=invalid');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.interpretation).toBeDefined();
      expect(res.body.data.translation).toBeDefined();
      expect(mockBitableService.getOngoingProjects).toHaveBeenCalled();
    });

    it('should return 502 when Bitable API fails', async () => {
      mockBitableService.getOngoingProjects.mockRejectedValue(new Error('飞书 API 超时'));

      const app = createApp(mockBitableService);
      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(502);
      expect(res.body).toEqual({
        success: false,
        error: '获取项目列表失败，请稍后重试',
      });
    });

    it('should return 502 when filtered Bitable API fails', async () => {
      mockBitableService.getOngoingProjectsByType.mockRejectedValue(new Error('network error'));

      const app = createApp(mockBitableService);
      const res = await request(app).get('/api/projects?type=interpretation');

      expect(res.status).toBe(502);
      expect(res.body).toEqual({
        success: false,
        error: '获取项目列表失败，请稍后重试',
      });
    });
  });

  describe('Unified JSON response format (Req 8.10)', () => {
    it('success responses have success: true and data field', async () => {
      mockBitableService.getOngoingProjects.mockResolvedValue([]);

      const app = createApp(mockBitableService);
      const res = await request(app).get('/api/projects');

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.error).toBeUndefined();
    });

    it('error responses have success: false and error field', async () => {
      mockBitableService.getOngoingProjects.mockRejectedValue(new Error('fail'));

      const app = createApp(mockBitableService);
      const res = await request(app).get('/api/projects');

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });
  });
});
