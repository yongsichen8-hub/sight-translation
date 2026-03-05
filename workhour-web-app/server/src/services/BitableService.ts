/**
 * 多维表格服务
 * 使用 user_access_token 直接调用飞书 REST API
 * 
 * 验证: 需求 2.1, 5.2
 */

import axios from 'axios';
import { Project, BitableConfig, ProjectType } from '../types/index';

const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

interface RecordFields {
  [fieldName: string]: unknown;
}

interface BitableRecord {
  record_id: string;
  fields: RecordFields;
}

export class BitableService {
  private config: BitableConfig;

  constructor(_appId: string, _appSecret: string, config: BitableConfig) {
    this.config = config;
  }

  private getTableId(projectType: ProjectType): string {
    return projectType === 'interpretation'
      ? this.config.interpretationTableId
      : this.config.translationTableId;
  }

  /**
   * 获取当前译员进行中的项目列表（口译+笔译）
   * @param userAccessToken 用户的 access_token
   * @param translatorName 当前登录译员的姓名，用于匹配"译员"字段
   */
  async getOngoingProjects(userAccessToken: string, translatorName?: string): Promise<Project[]> {
    const [interp, trans] = await Promise.all([
      this.getOngoingProjectsByType('interpretation', userAccessToken, translatorName),
      this.getOngoingProjectsByType('translation', userAccessToken, translatorName),
    ]);
    return [...interp, ...trans];
  }

  /**
   * 从记录字段中提取译员名称
   * 译员字段可能是：纯文本字符串、人员字段（对象数组含 name）、或普通数组
   */
  private extractTranslatorName(field: unknown): string {
    if (!field) return '';
    if (typeof field === 'string') return field.trim();
    if (Array.isArray(field)) {
      // 人员字段格式: [{ id: "xxx", name: "陈咏思", ... }]
      if (field.length > 0) {
        const first = field[0];
        if (typeof first === 'object' && first !== null && 'name' in first) {
          return String((first as { name: string }).name).trim();
        }
        // 文本字段格式: [{ text: "陈咏思", type: "text" }]
        if (typeof first === 'object' && first !== null && 'text' in first) {
          return String((first as { text: string }).text).trim();
        }
        return String(first).trim();
      }
    }
    return String(field).trim();
  }

  /**
   * 按类型获取进行中的项目
   * @param translatorName 如果提供，只返回匹配该译员的项目
   */
  async getOngoingProjectsByType(projectType: ProjectType, userAccessToken: string, translatorName?: string): Promise<Project[]> {
    const projects: Project[] = [];
    let pageToken: string | undefined;
    let hasMore = true;
    const tableId = this.getTableId(projectType);

    try {
      while (hasMore) {
        const url = `${FEISHU_BASE}/bitable/v1/apps/${this.config.appToken}/tables/${tableId}/records`;
        const reqParams: Record<string, string | number> = { page_size: 100 };
        if (pageToken) reqParams.page_token = pageToken;

        console.log(`[BitableService] GET ${url}`);
        console.log(`[BitableService] params:`, JSON.stringify(reqParams));
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${userAccessToken}` },
          params: reqParams,
        });

        const body = res.data;
        console.log(`[BitableService] Response code: ${body.code}, msg: ${body.msg || 'ok'}`);
        if (body.code !== 0) {
          throw new Error(`Bitable API error: ${body.msg} (code: ${body.code})`);
        }

        const items: BitableRecord[] = body.data?.items || [];
        console.log(`[BitableService] Got ${items.length} records from ${projectType} table`);

        // 打印第一条记录的所有字段名，方便调试
        if (items.length > 0) {
          const fieldNames = Object.keys(items[0].fields);
          console.log(`[BitableService] Available fields:`, fieldNames.join(', '));
          // 打印第一条记录的详细内容
          console.log(`[BitableService] First record sample:`, JSON.stringify(items[0].fields, null, 2));
        }

        for (const record of items) {
          // 1. 过滤承接进度 === "进行中"
          const statusField = record.fields[this.config.statusFieldName];
          const statusStr = Array.isArray(statusField)
            ? String(statusField[0])
            : String(statusField ?? '');

          if (statusStr !== '进行中') continue;

          // 2. 如果提供了译员名称，过滤匹配的译员
          if (translatorName) {
            const recordTranslator = this.extractTranslatorName(record.fields['译员']);
            console.log(`[BitableService] Record translator: "${recordTranslator}", looking for: "${translatorName}"`);
            if (recordTranslator !== translatorName) continue;
          }

          const project = this.parseProjectRecord(record, projectType);
          if (project) projects.push(project);
        }

        pageToken = body.data?.page_token;
        hasMore = body.data?.has_more ?? false;
      }

      console.log(`[BitableService] Found ${projects.length} matching ${projectType} projects`);
      return projects;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (axios.isAxiosError(error) && error.response) {
        console.error(`[BitableService] HTTP ${error.response.status}:`, JSON.stringify(error.response.data));
      }
      console.error(`[BitableService] 获取${projectType === 'interpretation' ? '口译' : '笔译'}项目失败:`, msg);
      throw new Error(`获取${projectType === 'interpretation' ? '口译' : '笔译'}项目列表失败: ${msg}`);
    }
  }

  private parseProjectRecord(record: BitableRecord, projectType: ProjectType): Project | null {
    const fields = record.fields;
    const nameField = fields['项目名称'];
    const statusField = fields[this.config.statusFieldName];
    if (!nameField) return null;

    let name: string;
    if (typeof nameField === 'string') {
      name = nameField;
    } else if (Array.isArray(nameField) && nameField.length > 0) {
      const first = nameField[0];
      name = typeof first === 'object' && first !== null && 'text' in first
        ? String((first as { text: string }).text)
        : String(first);
    } else {
      name = String(nameField);
    }

    let status: string;
    if (typeof statusField === 'string') {
      status = statusField;
    } else if (Array.isArray(statusField) && statusField.length > 0) {
      status = String(statusField[0]);
    } else {
      status = String(statusField ?? '');
    }

    return { recordId: record.record_id, name, status, projectType };
  }

  /**
   * 更新工时统计字段
   */
  async updateWorkhourStats(
    projectName: string,
    projectType: ProjectType,
    totalMinutes: number,
    userAccessToken: string,
    recordId?: string
  ): Promise<void> {
    const tableId = this.getTableId(projectType);

    try {
      const targetRecordId = recordId || await this.findProjectRecord(projectName, projectType, userAccessToken);
      if (!targetRecordId) {
        throw new Error(`找不到项目记录: ${projectName}`);
      }

      // 先读取该记录，看看实际有哪些字段
      const readUrl = `${FEISHU_BASE}/bitable/v1/apps/${this.config.appToken}/tables/${tableId}/records/${targetRecordId}`;
      try {
        const readRes = await axios.get(readUrl, {
          headers: { Authorization: `Bearer ${userAccessToken}` },
        });
        if (readRes.data.code === 0 && readRes.data.data?.record?.fields) {
          const actualFields = Object.keys(readRes.data.data.record.fields);
          console.log(`[BitableService] Record fields in this table:`, actualFields.join(', '));
        }
      } catch (e) {
        console.log(`[BitableService] Could not read record fields for debugging`);
      }

      const url = `${FEISHU_BASE}/bitable/v1/apps/${this.config.appToken}/tables/${tableId}/records/${targetRecordId}`;
      const payload = {
        fields: { [this.config.workhourFieldName]: totalMinutes },
      };
      console.log(`[BitableService] PUT ${url}`);
      console.log(`[BitableService] Payload:`, JSON.stringify(payload));

      const res = await axios.put(url, payload, {
        headers: { Authorization: `Bearer ${userAccessToken}` },
      });

      console.log(`[BitableService] Update response code: ${res.data.code}, msg: ${res.data.msg || 'ok'}`);
      if (res.data.code !== 0) {
        throw new Error(`Update failed: ${res.data.msg} (code: ${res.data.code})`);
      }
      console.log(`[BitableService] 工时更新成功: ${projectName} = ${totalMinutes} min`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (axios.isAxiosError(error) && error.response) {
        console.error(`[BitableService] Update HTTP ${error.response.status}:`, JSON.stringify(error.response.data));
      }
      console.error(`[BitableService] 更新工时统计失败:`, msg);
      throw new Error(`更新工时统计失败: ${msg}`);
    }
  }

  private async findProjectRecord(projectName: string, projectType: ProjectType, userAccessToken: string): Promise<string | null> {
    const tableId = this.getTableId(projectType);
    try {
      const url = `${FEISHU_BASE}/bitable/v1/apps/${this.config.appToken}/tables/${tableId}/records`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${userAccessToken}` },
        params: {
          page_size: 100,
          filter: `CurrentValue.[项目名称]="${this.escapeFilterValue(projectName)}"`,
        },
      });

      if (res.data.code !== 0) return null;
      const items = res.data.data?.items || [];
      return items.length > 0 ? items[0].record_id : null;
    } catch {
      return null;
    }
  }

  private escapeFilterValue(value: string): string {
    return value.replace(/"/g, '\\"');
  }
}

export function createBitableService(appId: string, appSecret: string, config: BitableConfig): BitableService {
  return new BitableService(appId, appSecret, config);
}
