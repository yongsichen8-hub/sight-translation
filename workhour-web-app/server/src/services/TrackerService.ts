/**
 * Tracker 数据服务
 * 管理本地工时数据存储，与现有 workhour-tracker 数据格式兼容
 * 
 * 验证: 需求 4.1, 4.2, 4.3, 5.1
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TimeRecord, Translator, TrackerData } from '../types/index';

/**
 * 默认的空数据结构
 */
const DEFAULT_TRACKER_DATA: TrackerData = {
  translators: [],
  projects: {
    interpretation: [],
    translation: [],
  },
  timeRecords: [],
};

/**
 * TrackerService 类
 * 负责工时数据的持久化存储和查询
 */
export class TrackerService {
  private dataFilePath: string;
  private data: TrackerData | null = null;

  /**
   * 创建 TrackerService 实例
   * @param dataFilePath - 数据文件路径，默认为项目根目录下的 tracker-data.json
   */
  constructor(dataFilePath?: string) {
    this.dataFilePath = dataFilePath || path.join(process.cwd(), 'tracker-data.json');
  }

  /**
   * 加载数据文件
   * 如果文件不存在，则创建默认数据结构
   */
  private async loadData(): Promise<TrackerData> {
    if (this.data) {
      return this.data;
    }

    try {
      const content = await fs.readFile(this.dataFilePath, 'utf-8');
      this.data = JSON.parse(content) as TrackerData;
    } catch (error) {
      // 文件不存在或解析失败，使用默认数据
      this.data = {
        translators: [],
        projects: {
          interpretation: [],
          translation: [],
        },
        timeRecords: [],
      };
    }

    return this.data;
  }

  /**
   * 保存数据到文件
   */
  private async saveData(): Promise<void> {
    if (!this.data) {
      return;
    }

    const content = JSON.stringify(this.data, null, 2);
    await fs.writeFile(this.dataFilePath, content, 'utf-8');
  }


  /**
   * 写入工时记录
   * 验证: 需求 4.1, 4.2 - 将工时记录写入 Tracker 的数据存储
   * 
   * @param record - 工时记录（不含 id，id 将自动生成）
   */
  async addTimeRecord(record: Omit<TimeRecord, 'id'>): Promise<TimeRecord> {
    const data = await this.loadData();
    
    // 生成唯一 ID（使用时间戳）
    const newRecord: TimeRecord = {
      ...record,
      id: Date.now(),
    };

    data.timeRecords.push(newRecord);
    await this.saveData();

    return newRecord;
  }

  /**
   * 查找或创建译员记录
   * 验证: 需求 4.3, 6.3 - 自动创建不存在的译员记录
   * 
   * @param openId - 飞书用户 open_id
   * @param name - 译员姓名
   * @returns 译员记录
   */
  async findOrCreateTranslator(openId: string, name: string): Promise<Translator> {
    const data = await this.loadData();

    // 查找现有译员（通过 feishuOpenId）
    let translator = data.translators.find(t => t.feishuOpenId === openId);

    if (!translator) {
      // 创建新译员记录
      translator = {
        id: `translator_${Date.now()}`,
        name: name,
        feishuOpenId: openId,
      };
      data.translators.push(translator);
      await this.saveData();
    }

    return translator;
  }

  /**
   * 获取项目总工时
   * 验证: 需求 5.1 - 计算该项目下所有译员的工时记录总和
   * 
   * @param projectId - 项目 ID
   * @returns 项目总工时（分钟）
   */
  async getProjectTotalTime(projectId: string): Promise<number> {
    const data = await this.loadData();

    // 筛选该项目的所有工时记录，计算总和
    const totalTime = data.timeRecords
      .filter(record => record.projectId === projectId)
      .reduce((sum, record) => sum + record.time, 0);

    return totalTime;
  }

  /**
   * 获取所有工时记录
   * 
   * @returns 所有工时记录列表
   */
  async getAllTimeRecords(): Promise<TimeRecord[]> {
    const data = await this.loadData();
    return [...data.timeRecords];
  }

  /**
   * 获取所有译员记录
   * 
   * @returns 所有译员记录列表
   */
  async getAllTranslators(): Promise<Translator[]> {
    const data = await this.loadData();
    return [...data.translators];
  }

  /**
   * 通过 ID 查找译员
   * 
   * @param translatorId - 译员 ID
   * @returns 译员记录或 undefined
   */
  async findTranslatorById(translatorId: string): Promise<Translator | undefined> {
    const data = await this.loadData();
    return data.translators.find(t => t.id === translatorId);
  }

  /**
   * 通过飞书 open_id 查找译员
   * 验证: 需求 6.2 - 以飞书 open_id 作为唯一标识符查找译员
   * 
   * @param openId - 飞书用户 open_id
   * @returns 译员记录或 undefined
   */
  async findTranslatorByOpenId(openId: string): Promise<Translator | undefined> {
    const data = await this.loadData();
    return data.translators.find(t => t.feishuOpenId === openId);
  }

  /**
   * 获取指定项目的所有工时记录
   * 
   * @param projectId - 项目 ID
   * @returns 该项目的工时记录列表
   */
  async getTimeRecordsByProject(projectId: string): Promise<TimeRecord[]> {
    const data = await this.loadData();
    return data.timeRecords.filter(record => record.projectId === projectId);
  }

  /**
   * 获取指定译员的所有工时记录
   * 
   * @param translatorId - 译员 ID
   * @returns 该译员的工时记录列表
   */
  async getTimeRecordsByTranslator(translatorId: string): Promise<TimeRecord[]> {
    const data = await this.loadData();
    return data.timeRecords.filter(record => record.translatorId === translatorId);
  }

  /**
   * 按日期范围筛选工时记录
   * 验证: 需求 6.2, 6.3 - 支持按提交日期范围筛选工时记录
   *
   * @param startDate - 开始日期（含）
   * @param endDate - 结束日期（含）
   * @returns 日期范围内的工时记录列表
   */
  async getTimeRecordsByDateRange(startDate: string, endDate: string): Promise<TimeRecord[]> {
    const data = await this.loadData();
    return data.timeRecords.filter(record =>
      record.date >= startDate && record.date <= endDate
    );
  }

  /**
   * 组合筛选工时记录
   * 验证: 需求 8.7 - 支持 translatorId、projectId、startDate、endDate 参数筛选
   *
   * @param filters - 筛选条件
   * @returns 满足所有筛选条件的工时记录列表
   */
  async queryTimeRecords(filters: {
    translatorId?: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TimeRecord[]> {
    const data = await this.loadData();
    let records = [...data.timeRecords];

    if (filters.translatorId) {
      records = records.filter(r => r.translatorId === filters.translatorId);
    }
    if (filters.projectId) {
      records = records.filter(r => r.projectId === filters.projectId);
    }
    if (filters.startDate) {
      records = records.filter(r => r.date >= filters.startDate!);
    }
    if (filters.endDate) {
      records = records.filter(r => r.date <= filters.endDate!);
    }

    return records;
  }

  /**
   * 获取统计聚合数据
   * 验证: 需求 7.1, 8.8 - 工时统计概览和按维度分组统计
   *
   * @param startDate - 可选的开始日期筛选
   * @param endDate - 可选的结束日期筛选
   * @returns 统计聚合数据
   */
  async getStats(startDate?: string, endDate?: string): Promise<{
    totalTime: number;
    interpretationTime: number;
    translationTime: number;
    translatorCount: number;
    byTranslator: Array<{ name: string; totalTime: number; interpretationTime: number; translationTime: number }>;
    byProject: Array<{ name: string; type: string; totalTime: number }>;
  }> {
    const data = await this.loadData();
    let records = [...data.timeRecords];

    if (startDate) {
      records = records.filter(r => r.date >= startDate);
    }
    if (endDate) {
      records = records.filter(r => r.date <= endDate);
    }

    const totalTime = records.reduce((sum, r) => sum + r.time, 0);
    const interpretationTime = records.filter(r => r.type === 'interpretation').reduce((sum, r) => sum + r.time, 0);
    const translationTime = records.filter(r => r.type === 'translation').reduce((sum, r) => sum + r.time, 0);
    const translatorCount = new Set(records.map(r => r.translatorId)).size;

    const byTranslatorMap = new Map<string, { name: string; totalTime: number; interpretationTime: number; translationTime: number }>();
    for (const r of records) {
      const existing = byTranslatorMap.get(r.translatorId) || { name: r.translatorName, totalTime: 0, interpretationTime: 0, translationTime: 0 };
      existing.totalTime += r.time;
      if (r.type === 'interpretation') existing.interpretationTime += r.time;
      else existing.translationTime += r.time;
      byTranslatorMap.set(r.translatorId, existing);
    }

    const byProjectMap = new Map<string, { name: string; type: string; totalTime: number }>();
    for (const r of records) {
      const existing = byProjectMap.get(r.projectId) || { name: r.projectName, type: r.type, totalTime: 0 };
      existing.totalTime += r.time;
      byProjectMap.set(r.projectId, existing);
    }

    return {
      totalTime,
      interpretationTime,
      translationTime,
      translatorCount,
      byTranslator: Array.from(byTranslatorMap.values()),
      byProject: Array.from(byProjectMap.values()),
    };
  }

  /**
   * 更新工时记录（管理员编辑用）
   * @param recordId - 记录 ID
   * @param newTime - 新的工时（分钟）
   * @returns 更新后的记录，如果找不到返回 null
   */
  async updateTimeRecord(recordId: number, newTime: number): Promise<TimeRecord | null> {
    const data = await this.loadData();
    const record = data.timeRecords.find(r => r.id === recordId);
    if (!record) return null;
    record.time = newTime;
    await this.saveData();
    return { ...record };
  }

  /**
   * 清空所有数据（仅用于测试）
   */
  async clearAllData(): Promise<void> {
    this.data = {
      translators: [],
      projects: {
        interpretation: [],
        translation: [],
      },
      timeRecords: [],
    };
    await this.saveData();
  }

  /**
   * 重新加载数据（用于测试或刷新缓存）
   */
  async reload(): Promise<void> {
    this.data = null;
    await this.loadData();
  }
}

/**
 * 创建 TrackerService 实例的工厂函数
 * @param dataFilePath - 可选的数据文件路径
 */
export function createTrackerService(dataFilePath?: string): TrackerService {
  return new TrackerService(dataFilePath);
}
