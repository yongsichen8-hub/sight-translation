/**
 * 统计路由
 * 获取工时统计数据，支持按日期范围筛选
 *
 * Validates: Requirements 7.1, 8.8, 8.10
 */

import { Router, Request, Response } from 'express';
import { TrackerService } from '../services/TrackerService';

export function createStatsRouter(trackerService: TrackerService) {
  const router = Router();

  // GET / - 获取工时统计数据
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      let records = await trackerService.getAllTimeRecords();

      // Filter by date range
      if (startDate) {
        records = records.filter(r => r.date >= (startDate as string));
      }
      if (endDate) {
        records = records.filter(r => r.date <= (endDate as string));
      }

      // Calculate total times
      const totalTime = records.reduce((sum, r) => sum + r.time, 0);
      const interpretationTime = records
        .filter(r => r.type === 'interpretation')
        .reduce((sum, r) => sum + r.time, 0);
      const translationTime = records
        .filter(r => r.type === 'translation')
        .reduce((sum, r) => sum + r.time, 0);

      // Unique translator count
      const translatorIds = new Set(records.map(r => r.translatorId));
      const translatorCount = translatorIds.size;

      // Group by translator
      const byTranslatorMap = new Map<string, { name: string; totalTime: number; interpretationTime: number; translationTime: number }>();
      for (const record of records) {
        const existing = byTranslatorMap.get(record.translatorId) || {
          name: record.translatorName,
          totalTime: 0,
          interpretationTime: 0,
          translationTime: 0,
        };
        existing.totalTime += record.time;
        if (record.type === 'interpretation') {
          existing.interpretationTime += record.time;
        } else {
          existing.translationTime += record.time;
        }
        byTranslatorMap.set(record.translatorId, existing);
      }
      const byTranslator = Array.from(byTranslatorMap.values());

      // Group by project
      const byProjectMap = new Map<string, { name: string; type: string; totalTime: number }>();
      for (const record of records) {
        const existing = byProjectMap.get(record.projectId) || {
          name: record.projectName,
          type: record.type,
          totalTime: 0,
        };
        existing.totalTime += record.time;
        byProjectMap.set(record.projectId, existing);
      }
      const byProject = Array.from(byProjectMap.values());

      res.json({
        success: true,
        data: {
          totalTime,
          interpretationTime,
          translationTime,
          translatorCount,
          byTranslator,
          byProject,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: '获取统计数据失败' });
    }
  });

  return router;
}
