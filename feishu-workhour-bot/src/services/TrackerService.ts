/**
 * Tracker 数据服务
 * 管理本地工时数据存储，与现有 workhour-tracker 数据格式兼容
 * 
 * 验证: 需求 4.1, 4.2, 4.3, 5.1
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TimeRecord, Translator, TrackerData } from '../types';

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
      this.data = { ...DEFAULT_TRACKER_DATA };
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
   * 清空所有数据（仅用于测试）
   */
  async clearAllData(): Promise<void> {
    this.data = { ...DEFAULT_TRACKER_DATA };
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
