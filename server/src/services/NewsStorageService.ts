import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config';
import { DailyNews, NewsItem } from '../types/news';

/**
 * 新闻数据持久化服务
 * 以日期为文件名存储每日新闻（news/YYYY-MM-DD.json）
 * 遵循 FileStorageService 模式
 */
export class NewsStorageService {
  private newsDir: string;

  constructor(dataDir?: string) {
    const baseDir = dataDir || config.dataDir;
    this.newsDir = path.join(baseDir, 'news');
    this.ensureDir();
  }

  /**
   * 确保新闻数据目录存在
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.newsDir, { recursive: true });
  }

  /**
   * 获取指定日期的文件路径
   */
  private getFilePath(date: string): string {
    return path.join(this.newsDir, `${date}.json`);
  }

  /**
   * 保存每日新闻数据
   */
  async saveDailyNews(dailyNews: DailyNews): Promise<void> {
    await this.ensureDir();
    const filePath = this.getFilePath(dailyNews.date);
    const content = JSON.stringify(dailyNews, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * 获取指定日期的每日新闻，不存在则返回 null
   */
  async getDailyNews(date: string): Promise<DailyNews | null> {
    const filePath = this.getFilePath(date);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as DailyNews;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new Error(`NEWS_READ_ERROR: 读取新闻数据失败 - ${(error as Error).message}`);
    }
  }

  /**
   * 获取最新的每日新闻（按文件名日期降序，取第一个）
   */
  async getLatestDailyNews(): Promise<DailyNews | null> {
    await this.ensureDir();
    try {
      const files = await fs.readdir(this.newsDir);
      const jsonFiles = files
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse();

      if (jsonFiles.length === 0) {
        return null;
      }

      const latestDate = jsonFiles[0].replace('.json', '');
      return this.getDailyNews(latestDate);
    } catch {
      return null;
    }
  }

  /**
   * 从指定日期的新闻中获取单条新闻
   */
  async getNewsItemById(date: string, id: string): Promise<NewsItem | null> {
    const dailyNews = await this.getDailyNews(date);
    if (!dailyNews) {
      return null;
    }
    return dailyNews.items.find((item) => item.id === id) || null;
  }
}
