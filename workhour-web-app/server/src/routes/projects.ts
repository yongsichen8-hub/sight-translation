/**
 * 项目路由
 * 获取进行中的项目列表，支持按类型筛选
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5, 8.5, 8.10
 */

import { Router, Request, Response } from 'express';
import { BitableService } from '../services/BitableService';
import { getUserAccessToken } from '../services/TokenStore';

export function createProjectsRouter(bitableService: BitableService) {
  const router = Router();

  // GET / - 获取进行中的项目列表，按口译/笔译分组返回
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userAccessToken = await getUserAccessToken(req.user!.feishuOpenId);
      const translatorName = req.user!.name; // 用登录用户的姓名匹配"译员"字段
      const { type } = req.query;

      console.log(`[Projects] Fetching projects for translator: "${translatorName}"`);

      // 支持 type 查询参数筛选单一类型
      if (type === 'interpretation' || type === 'translation') {
        const projects = await bitableService.getOngoingProjectsByType(type, userAccessToken, translatorName);
        res.json({
          success: true,
          data: { [type]: projects },
        });
        return;
      }

      // 获取所有进行中项目并按类型分组
      const allProjects = await bitableService.getOngoingProjects(userAccessToken, translatorName);
      const interpretation = allProjects.filter(p => p.projectType === 'interpretation');
      const translation = allProjects.filter(p => p.projectType === 'translation');

      res.json({
        success: true,
        data: { interpretation, translation },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[Projects] 获取项目列表失败:', msg);
      // 如果是 token 问题，返回 401 让前端重新登录
      if (msg.includes('TOKEN_NOT_FOUND') || msg.includes('REFRESH_EXPIRED')) {
        res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
        return;
      }
      res.status(502).json({
        success: false,
        error: '获取项目列表失败，请稍后重试',
      });
    }
  });

  return router;
}
