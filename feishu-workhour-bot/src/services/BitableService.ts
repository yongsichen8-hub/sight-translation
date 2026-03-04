/**
 * 多维表格服务
 * 封装飞书多维表格 API 操作
 * 
 * 验证: 需求 2.1 - 从口译表和笔译表中读取所有状态为"进行中"的项目记录
 * 验证: 需求 5.2 - 将计算得到的项目总工时更新至对应表中项目行的"工时统计/min"字段
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { Project } from '../types/index';
import { BitableConfig, ProjectType } from '../types/feishu';

/**
 * 多维表格记录字段值类型
 */
interface RecordFields {
  [fieldName: string]: unknown;
}

/**
 * 多维表格记录
 */
interface BitableRecord {
  record_id: string;
  fields: RecordFields;
}

/**
 * 列表记录响应
 */
interface ListRecordsResponse {
  items?: BitableRecord[];
  page_token?: string;
  has_more?: boolean;
  total?: number;
}

/**
 * BitableService 类
 * 提供飞书多维表格的读写操作
 */
export class BitableService {
  private client: lark.Client;
  private config: BitableConfig;

  /**
   * 构造函数
   * @param appId 飞书应用 App ID
   * @param appSecret 飞书应用 App Secret
   * @param config 多维表格配置
   */
  constructor(appId: string, appSecret: string, config: BitableConfig) {
    this.client = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
    this.config = config;
  }


  /**
   * 根据项目类型获取表 ID
   * @param projectType 项目类型
   * @returns 表 ID
   */
  private getTableId(projectType: ProjectType): string {
    return projectType === 'interpretation' 
      ? this.config.interpretationTableId 
      : this.config.translationTableId;
  }

  /**
   * 获取进行中的项目列表
   * 从口译表和笔译表中读取所有状态为"进行中"的项目
   * 
   * 验证: 需求 2.1 - 从口译表和笔译表中读取所有状态为"进行中"的项目记录
   * 
   * @returns 进行中的项目列表（包含项目类型）
   * @throws 当 API 调用失败时抛出错误
   */
  async getOngoingProjects(): Promise<Project[]> {
    const [interpretationProjects, translationProjects] = await Promise.all([
      this.getOngoingProjectsByType('interpretation'),
      this.getOngoingProjectsByType('translation'),
    ]);

    return [...interpretationProjects, ...translationProjects];
  }

  /**
   * 按类型获取进行中的项目列表
   * @param projectType 项目类型
   * @returns 进行中的项目列表
   */
  async getOngoingProjectsByType(projectType: ProjectType): Promise<Project[]> {
    const projects: Project[] = [];
    let pageToken: string | undefined;
    let hasMore = true;
    const tableId = this.getTableId(projectType);

    try {
      // 使用分页查询获取所有记录
      while (hasMore) {
        const response = await this.client.bitable.appTableRecord.list({
          path: {
            app_token: this.config.appToken,
            table_id: tableId,
          },
          params: {
            page_size: 100,
            page_token: pageToken,
            // 使用 filter 参数过滤状态为"进行中"的记录
            filter: `CurrentValue.[${this.config.statusFieldName}]="进行中"`,
          },
        });

        if (response.code !== 0) {
          throw new Error(`Failed to list records: ${response.msg} (code: ${response.code})`);
        }

        const data = response.data as ListRecordsResponse | undefined;
        
        if (data?.items) {
          for (const record of data.items) {
            const project = this.parseProjectRecord(record, projectType);
            if (project) {
              projects.push(project);
            }
          }
        }

        pageToken = data?.page_token;
        hasMore = data?.has_more ?? false;
      }

      return projects;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`获取${projectType === 'interpretation' ? '口译' : '笔译'}项目列表失败: ${errorMessage}`);
    }
  }

  /**
   * 解析项目记录
   * @param record 多维表格记录
   * @param projectType 项目类型
   * @returns 项目对象，如果解析失败返回 null
   */
  private parseProjectRecord(record: BitableRecord, projectType: ProjectType): Project | null {
    const fields = record.fields;
    
    // 获取项目名称字段（假设字段名为"项目名称"）
    const nameField = fields['项目名称'];
    const statusField = fields[this.config.statusFieldName];

    if (!nameField) {
      return null;
    }

    // 处理不同类型的字段值
    let name: string;
    if (typeof nameField === 'string') {
      name = nameField;
    } else if (Array.isArray(nameField) && nameField.length > 0) {
      // 文本字段可能是数组格式
      const firstItem = nameField[0];
      name = typeof firstItem === 'object' && firstItem !== null && 'text' in firstItem
        ? String((firstItem as { text: string }).text)
        : String(firstItem);
    } else {
      name = String(nameField);
    }

    // 处理状态字段
    let status: string;
    if (typeof statusField === 'string') {
      status = statusField;
    } else if (Array.isArray(statusField) && statusField.length > 0) {
      status = String(statusField[0]);
    } else {
      status = String(statusField ?? '');
    }

    return {
      recordId: record.record_id,
      name,
      status,
      projectType,
    };
  }


  /**
   * 更新工时统计字段
   * 将项目总工时更新至对应表中项目行
   * 
   * 验证: 需求 5.2 - 将计算得到的项目总工时更新至对应表中项目行的"工时统计/min"字段
   * 
   * @param projectName 项目名称
   * @param projectType 项目类型
   * @param totalMinutes 总工时（分钟）
   * @param recordId 记录 ID（可选，如果已知）
   * @throws 当 API 调用失败时抛出错误
   */
  async updateWorkhourStats(
    projectName: string, 
    projectType: ProjectType, 
    totalMinutes: number,
    recordId?: string
  ): Promise<void> {
    const tableId = this.getTableId(projectType);
    
    try {
      // 如果没有提供 recordId，需要先查找
      const targetRecordId = recordId || await this.findProjectRecord(projectName, projectType);
      
      if (!targetRecordId) {
        throw new Error(`找不到项目记录: ${projectName}`);
      }

      // 更新工时统计字段
      const response = await this.client.bitable.appTableRecord.update({
        path: {
          app_token: this.config.appToken,
          table_id: tableId,
          record_id: targetRecordId,
        },
        data: {
          fields: {
            [this.config.workhourFieldName]: totalMinutes,
          },
        },
      });

      if (response.code !== 0) {
        throw new Error(`Failed to update record: ${response.msg} (code: ${response.code})`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`更新工时统计失败: ${errorMessage}`);
    }
  }

  /**
   * 查找项目记录
   * @param projectName 项目名称
   * @param projectType 项目类型
   * @returns 记录 ID，如果不存在返回 null
   */
  private async findProjectRecord(projectName: string, projectType: ProjectType): Promise<string | null> {
    const tableId = this.getTableId(projectType);
    
    try {
      const response = await this.client.bitable.appTableRecord.list({
        path: {
          app_token: this.config.appToken,
          table_id: tableId,
        },
        params: {
          page_size: 100,
          filter: `CurrentValue.[项目名称]="${this.escapeFilterValue(projectName)}"`,
        },
      });

      if (response.code !== 0) {
        throw new Error(`Failed to search records: ${response.msg} (code: ${response.code})`);
      }

      const data = response.data as ListRecordsResponse | undefined;
      
      if (data?.items && data.items.length > 0) {
        return data.items[0].record_id;
      }

      return null;
    } catch (error) {
      console.error('查找项目记录失败:', error);
      return null;
    }
  }

  /**
   * 转义 filter 值中的特殊字符
   * @param value 原始值
   * @returns 转义后的值
   */
  private escapeFilterValue(value: string): string {
    // 转义双引号
    return value.replace(/"/g, '\\"');
  }
}

/**
 * 创建 BitableService 实例的工厂函数
 * @param appId 飞书应用 App ID
 * @param appSecret 飞书应用 App Secret
 * @param config 多维表格配置
 * @returns BitableService 实例
 */
export function createBitableService(
  appId: string,
  appSecret: string,
  config: BitableConfig
): BitableService {
  return new BitableService(appId, appSecret, config);
}
