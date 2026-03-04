/**
 * BitableService 单元测试
 * 测试多维表格服务的核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BitableService } from '../../src/services/BitableService';
import { BitableConfig } from '../../src/types/feishu';

// Mock @larksuiteoapi/node-sdk
vi.mock('@larksuiteoapi/node-sdk', () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      bitable: {
        appTableRecord: {
          list: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    })),
    AppType: {
      SelfBuild: 'self_build',
    },
    Domain: {
      Feishu: 'feishu',
    },
  };
});

describe('BitableService', () => {
  let service: BitableService;
  let mockClient: any;
  const testConfig: BitableConfig = {
    appToken: 'test_app_token',
    interpretationTableId: 'test_interpretation_table',
    translationTableId: 'test_translation_table',
    statusFieldName: '承接进度',
    workhourFieldName: '工时统计/min',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // 创建服务实例
    service = new BitableService('test_app_id', 'test_app_secret', testConfig);
    
    // 获取 mock client
    const lark = await import('@larksuiteoapi/node-sdk');
    mockClient = (lark.Client as any).mock.results[0].value;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });


  describe('getOngoingProjects', () => {
    it('should return ongoing projects from both tables', async () => {
      // 模拟 API 响应 - 口译表和笔译表
      mockClient.bitable.appTableRecord.list
        .mockResolvedValueOnce({
          code: 0,
          msg: 'success',
          data: {
            items: [
              {
                record_id: 'rec_001',
                fields: {
                  '项目名称': '口译项目A',
                  '承接进度': '进行中',
                },
              },
            ],
            has_more: false,
          },
        })
        .mockResolvedValueOnce({
          code: 0,
          msg: 'success',
          data: {
            items: [
              {
                record_id: 'rec_002',
                fields: {
                  '项目名称': '笔译项目B',
                  '承接进度': '进行中',
                },
              },
            ],
            has_more: false,
          },
        });

      const projects = await service.getOngoingProjects();

      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({
        recordId: 'rec_001',
        name: '口译项目A',
        status: '进行中',
        projectType: 'interpretation',
      });
      expect(projects[1]).toEqual({
        recordId: 'rec_002',
        name: '笔译项目B',
        status: '进行中',
        projectType: 'translation',
      });
    });

    it('should handle pagination correctly', async () => {
      // 口译表第一页
      mockClient.bitable.appTableRecord.list
        .mockResolvedValueOnce({
          code: 0,
          msg: 'success',
          data: {
            items: [
              {
                record_id: 'rec_001',
                fields: {
                  '项目名称': '口译项目A',
                  '承接进度': '进行中',
                },
              },
            ],
            has_more: true,
            page_token: 'next_page_token',
          },
        })
        // 口译表第二页
        .mockResolvedValueOnce({
          code: 0,
          msg: 'success',
          data: {
            items: [
              {
                record_id: 'rec_002',
                fields: {
                  '项目名称': '口译项目B',
                  '承接进度': '进行中',
                },
              },
            ],
            has_more: false,
          },
        })
        // 笔译表
        .mockResolvedValueOnce({
          code: 0,
          msg: 'success',
          data: {
            items: [],
            has_more: false,
          },
        });

      const projects = await service.getOngoingProjects();

      expect(projects).toHaveLength(2);
      expect(mockClient.bitable.appTableRecord.list).toHaveBeenCalledTimes(3);
    });

    it('should return empty array when no projects found', async () => {
      mockClient.bitable.appTableRecord.list
        .mockResolvedValueOnce({
          code: 0,
          msg: 'success',
          data: {
            items: [],
            has_more: false,
          },
        })
        .mockResolvedValueOnce({
          code: 0,
          msg: 'success',
          data: {
            items: [],
            has_more: false,
          },
        });

      const projects = await service.getOngoingProjects();

      expect(projects).toHaveLength(0);
    });

    it('should throw error when API call fails', async () => {
      mockClient.bitable.appTableRecord.list.mockResolvedValue({
        code: 1254002,
        msg: 'Fail',
      });

      await expect(service.getOngoingProjects()).rejects.toThrow('获取口译项目列表失败');
    });

    it('should handle text field as array format', async () => {
      mockClient.bitable.appTableRecord.list
        .mockResolvedValueOnce({
          code: 0,
          msg: 'success',
          data: {
            items: [
              {
                record_id: 'rec_001',
                fields: {
                  '项目名称': [{ text: '口译项目A', type: 'text' }],
                  '承接进度': '进行中',
                },
              },
            ],
            has_more: false,
          },
        })
        .mockResolvedValueOnce({
          code: 0,
          msg: 'success',
          data: {
            items: [],
            has_more: false,
          },
        });

      const projects = await service.getOngoingProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('口译项目A');
    });
  });


  describe('getOngoingProjectsByType', () => {
    it('should return only interpretation projects when type is interpretation', async () => {
      mockClient.bitable.appTableRecord.list.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          items: [
            {
              record_id: 'rec_001',
              fields: {
                '项目名称': '口译项目A',
                '承接进度': '进行中',
              },
            },
          ],
          has_more: false,
        },
      });

      const projects = await service.getOngoingProjectsByType('interpretation');

      expect(projects).toHaveLength(1);
      expect(projects[0].projectType).toBe('interpretation');
      expect(mockClient.bitable.appTableRecord.list).toHaveBeenCalledWith({
        path: {
          app_token: testConfig.appToken,
          table_id: testConfig.interpretationTableId,
        },
        params: expect.objectContaining({
          filter: `CurrentValue.[${testConfig.statusFieldName}]="进行中"`,
        }),
      });
    });

    it('should return only translation projects when type is translation', async () => {
      mockClient.bitable.appTableRecord.list.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          items: [
            {
              record_id: 'rec_002',
              fields: {
                '项目名称': '笔译项目B',
                '承接进度': '进行中',
              },
            },
          ],
          has_more: false,
        },
      });

      const projects = await service.getOngoingProjectsByType('translation');

      expect(projects).toHaveLength(1);
      expect(projects[0].projectType).toBe('translation');
      expect(mockClient.bitable.appTableRecord.list).toHaveBeenCalledWith({
        path: {
          app_token: testConfig.appToken,
          table_id: testConfig.translationTableId,
        },
        params: expect.objectContaining({
          filter: `CurrentValue.[${testConfig.statusFieldName}]="进行中"`,
        }),
      });
    });
  });


  describe('updateWorkhourStats', () => {
    it('should update workhour stats for interpretation project', async () => {
      // 更新成功
      mockClient.bitable.appTableRecord.update.mockResolvedValue({
        code: 0,
        msg: 'success',
      });

      await service.updateWorkhourStats('口译项目A', 'interpretation', 200, 'rec_001');

      expect(mockClient.bitable.appTableRecord.update).toHaveBeenCalledWith({
        path: {
          app_token: testConfig.appToken,
          table_id: testConfig.interpretationTableId,
          record_id: 'rec_001',
        },
        data: {
          fields: {
            '工时统计/min': 200,
          },
        },
      });
    });

    it('should update workhour stats for translation project', async () => {
      // 更新成功
      mockClient.bitable.appTableRecord.update.mockResolvedValue({
        code: 0,
        msg: 'success',
      });

      await service.updateWorkhourStats('笔译项目B', 'translation', 150, 'rec_002');

      expect(mockClient.bitable.appTableRecord.update).toHaveBeenCalledWith({
        path: {
          app_token: testConfig.appToken,
          table_id: testConfig.translationTableId,
          record_id: 'rec_002',
        },
        data: {
          fields: {
            '工时统计/min': 150,
          },
        },
      });
    });

    it('should find record when recordId not provided', async () => {
      // 查找返回现有记录
      mockClient.bitable.appTableRecord.list.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          items: [
            {
              record_id: 'found_rec_001',
              fields: {
                '项目名称': '口译项目A',
              },
            },
          ],
          has_more: false,
        },
      });

      // 更新成功
      mockClient.bitable.appTableRecord.update.mockResolvedValue({
        code: 0,
        msg: 'success',
      });

      await service.updateWorkhourStats('口译项目A', 'interpretation', 200);

      expect(mockClient.bitable.appTableRecord.update).toHaveBeenCalledWith({
        path: {
          app_token: testConfig.appToken,
          table_id: testConfig.interpretationTableId,
          record_id: 'found_rec_001',
        },
        data: {
          fields: {
            '工时统计/min': 200,
          },
        },
      });
    });

    it('should throw error when record not found and no recordId provided', async () => {
      // 查找返回空
      mockClient.bitable.appTableRecord.list.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          items: [],
          has_more: false,
        },
      });

      await expect(service.updateWorkhourStats('不存在的项目', 'interpretation', 200))
        .rejects.toThrow('找不到项目记录');
    });

    it('should throw error when update fails', async () => {
      // 更新失败
      mockClient.bitable.appTableRecord.update.mockResolvedValue({
        code: 1254002,
        msg: 'Fail',
      });

      await expect(service.updateWorkhourStats('项目A', 'interpretation', 200, 'rec_001'))
        .rejects.toThrow('更新工时统计失败');
    });
  });
});
