import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config';
import { DailyBriefing, NewsEntry } from '../types/briefing';

/**
 * 每日简报持久化服务
 * 以日期为文件名存储简报（briefings/YYYY-MM-DD.json）
 * 参照 NewsStorageService 模式
 */
export class BriefingStorageService {
  private briefingsDir: string;

  constructor(dataDir?: string) {
    const baseDir = dataDir || config.dataDir;
    this.briefingsDir = path.join(baseDir, 'briefings');
    this.ensureDir();
  }

  /**
   * 确保简报数据目录存在
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.briefingsDir, { recursive: true });
  }

  /**
   * 获取指定日期的文件路径
   */
  private getFilePath(date: string): string {
    return path.join(this.briefingsDir, `${date}.json`);
  }

  /**
   * 保存每日简报
   */
  async saveDailyBriefing(briefing: DailyBriefing): Promise<void> {
    await this.ensureDir();
    const filePath = this.getFilePath(briefing.date);
    const content = JSON.stringify(briefing, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * 获取指定日期的简报，不存在则返回 null
   */
  async getDailyBriefing(date: string): Promise<DailyBriefing | null> {
    const filePath = this.getFilePath(date);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as DailyBriefing;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new Error(`BRIEFING_READ_ERROR: 读取简报数据失败 - ${(error as Error).message}`);
    }
  }

  /**
   * 获取最新简报（按文件名日期降序，取第一个）
   */
  async getLatestBriefing(): Promise<DailyBriefing | null> {
    await this.ensureDir();
    try {
      const files = await fs.readdir(this.briefingsDir);
      const jsonFiles = files
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse();

      if (jsonFiles.length === 0) {
        return null;
      }

      const latestDate = jsonFiles[0].replace('.json', '');
      return this.getDailyBriefing(latestDate);
    } catch {
      return null;
    }
  }

  /**
   * 获取指定日期简报中的单条新闻条目
   */
  async getNewsEntry(date: string, entryId: string): Promise<NewsEntry | null> {
    const briefing = await this.getDailyBriefing(date);
    if (!briefing) {
      return null;
    }
    return briefing.entries.find((entry) => entry.id === entryId) || null;
  }
}
