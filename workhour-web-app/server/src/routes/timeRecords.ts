/**
 * 工时记录路由
 * 处理工时记录的提交和查询
 *
 * Validates: Requirements 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 5.4, 8.6, 8.7, 8.10
 */

import { Router, Request, Response } from 'express';
import { TrackerService } from '../services/TrackerService';
import { BitableService } from '../services/BitableService';
import { isPositiveInteger } from '../validators/FormValidator';
import { TimeRecord } from '../types/index';
import { getUserAccessToken } from '../services/TokenStore';
import { config } from '../config/index';

export function createTimeRecordsRouter(
  trackerService: TrackerService,
  bitableService: BitableService
) {
  const router = Router();

  // POST / - 提交工时记录
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { entries } = req.body;
      const user = req.user!;

      // Validate entries exist and are non-empty array
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ success: false, error: '请至少填写一条工时记录' });
        return;
      }

      // Validate each entry
      for (const entry of entries) {
        if (!entry.projectId || !entry.projectName || !entry.type || !isPositiveInteger(entry.time)) {
          res.status(400).json({ success: false, error: '工时记录格式不正确' });
          return;
        }
        if (entry.type !== 'interpretation' && entry.type !== 'translation') {
          res.status(400).json({ success: false, error: '项目类型必须为 interpretation 或 translation' });
          return;
        }
      }

      // Write records to local storage
      const records: TimeRecord[] = [];
      for (const entry of entries) {
        const record = await trackerService.addTimeRecord({
          translatorId: user.userId,
          translatorName: user.name,
          projectId: entry.projectId,
          projectName: entry.projectName,
          type: entry.type,
          time: entry.time,
          date: new Date().toISOString(),
        });
        records.push(record);
      }

      // Sync to Bitable - calculate project totals and update
      let syncStatus = 'success';
      try {
        const userAccessToken = await getUserAccessToken(user.feishuOpenId);
        const projectIds = [...new Set(entries.map((e: any) => e.projectId))];
        console.log(`[TimeRecords] Syncing ${projectIds.length} projects to Bitable`);
        for (const projectId of projectIds) {
          const totalTime = await trackerService.getProjectTotalTime(projectId as string);
          const entry = entries.find((e: any) => e.projectId === projectId)!;
          console.log(`[TimeRecords] Updating "${entry.projectName}" (recordId: ${projectId}, type: ${entry.type}, totalTime: ${totalTime})`);
          await bitableService.updateWorkhourStats(
            entry.projectName,
            entry.type,
            totalTime,
            userAccessToken,
            projectId as string
          );
        }
        console.log('[TimeRecords] Bitable sync completed successfully');
      } catch (error) {
        // Local write succeeded but Bitable sync failed
        syncStatus = 'partial';
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[TimeRecords] 飞书同步失败:', errMsg);
      }

      res.json({ success: true, data: { records, syncStatus } });
    } catch (error) {
      res.status(500).json({ success: false, error: '提交工时失败' });
    }
  });

  // GET / - 查询工时记录，支持筛选
  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const { projectId, startDate, endDate } = req.query;

      // Data isolation: users can only see their own records (Req 5.4)
      let records = await trackerService.getTimeRecordsByTranslator(user.userId);

      // Filter by projectId
      if (projectId) {
        records = records.filter(r => r.projectId === projectId);
      }

      // Filter by date range
      if (startDate) {
        records = records.filter(r => r.date >= (startDate as string));
      }
      if (endDate) {
        records = records.filter(r => r.date <= (endDate as string));
      }

      res.json({ success: true, data: records });
    } catch (error) {
      res.status(500).json({ success: false, error: '查询工时记录失败' });
    }
  });

  // GET /all - 管理员获取所有译员的工时记录
  router.get('/all', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      if (!config.ADMIN_OPEN_IDS.includes(user.feishuOpenId)) {
        res.status(403).json({ success: false, error: '无权限' });
        return;
      }

      let records = await trackerService.getAllTimeRecords();
      const { projectId, startDate, endDate } = req.query;
      if (projectId) records = records.filter(r => r.projectId === projectId);
      if (startDate) records = records.filter(r => r.date >= (startDate as string));
      if (endDate) records = records.filter(r => r.date <= (endDate as string));

      res.json({ success: true, data: records });
    } catch (error) {
      res.status(500).json({ success: false, error: '查询工时记录失败' });
    }
  });

  // PUT /:id - 管理员编辑工时记录
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      console.log(`[TimeRecords] PUT /:id - user: ${user.feishuOpenId}, isAdmin: ${user.isAdmin}, ADMIN_IDS: ${JSON.stringify(config.ADMIN_OPEN_IDS)}`);
      if (!config.ADMIN_OPEN_IDS.includes(user.feishuOpenId)) {
        console.log(`[TimeRecords] PUT /:id - 403 forbidden`);
        res.status(403).json({ success: false, error: '无权限' });
        return;
      }

      const recordId = parseInt(req.params.id, 10);
      const { time } = req.body;
      console.log(`[TimeRecords] PUT /:id - recordId: ${recordId}, time: ${time} (type: ${typeof time})`);
      if (isNaN(recordId) || typeof time !== 'number' || !isFinite(time) || time < 0) {
        res.status(400).json({ success: false, error: '参数不正确' });
        return;
      }

      const updated = await trackerService.updateTimeRecord(recordId, time);
      if (!updated) {
        res.status(404).json({ success: false, error: '记录不存在' });
        return;
      }

      // Re-sync project total to Bitable
      let syncStatus = 'success';
      try {
        const userAccessToken = await getUserAccessToken(user.feishuOpenId);
        const totalTime = await trackerService.getProjectTotalTime(updated.projectId);
        console.log(`[TimeRecords] Admin update: re-syncing "${updated.projectName}" (totalTime: ${totalTime})`);
        await bitableService.updateWorkhourStats(
          updated.projectName,
          updated.type,
          totalTime,
          userAccessToken,
          updated.projectId
        );
      } catch (error) {
        syncStatus = 'partial';
        console.error('[TimeRecords] Admin edit Bitable sync failed:', error instanceof Error ? error.message : error);
      }

      res.json({ success: true, data: { record: updated, syncStatus } });
    } catch (error) {
      res.status(500).json({ success: false, error: '更新工时记录失败' });
    }
  });

  return router;
}
