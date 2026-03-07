import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config';
import { DailyNews, NewsItem } from '../types';

export class NewsStorageService {
  private newsDir: string;

  constructor() {
    this.newsDir = path.join(config.dataDir, 'news');
    this.ensureDir();
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.newsDir, { recursive: true });
  }

  async saveDailyNews(dailyNews: DailyNews): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(path.join(this.newsDir, `${dailyNews.date}.json`), JSON.stringify(dailyNews, null, 2), 'utf-8');
  }

  async getDailyNews(date: string): Promise<DailyNews | null> {
    try {
      const content = await fs.readFile(path.join(this.newsDir, `${date}.json`), 'utf-8');
      return JSON.parse(content) as DailyNews;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async getLatestDailyNews(): Promise<DailyNews | null> {
    await this.ensureDir();
    try {
      const files = await fs.readdir(this.newsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();
      if (jsonFiles.length === 0) return null;
      return this.getDailyNews(jsonFiles[0].replace('.json', ''));
    } catch { return null; }
  }

  async getNewsItemById(date: string, id: string): Promise<NewsItem | null> {
    const daily = await this.getDailyNews(date);
    return daily?.items.find((item) => item.id === id) || null;
  }
}
