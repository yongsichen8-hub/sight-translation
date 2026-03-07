/**
 * News API Client
 * 封装新闻相关 API 调用，遵循 ApiClient.ts 的模式
 */

import type { DailyNews, NewsItem } from '../types/news';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface NewsSource {
  id: string;
  name: string;
  url: string;
  language: 'zh' | 'en';
  domain: string;
  tier: 'T1' | 'T2';
  weight: number;
  enabled: boolean;
}

class NewsApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || '请求失败');
    }

    return data.data as T;
  }

  /**
   * 获取每日新闻列表
   * @param date 日期 YYYY-MM-DD，默认今天
   * @param domain 领域筛选
   */
  async getDailyNews(date?: string, domain?: string): Promise<DailyNews> {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (domain) params.set('domain', domain);
    const query = params.toString();
    return this.request<DailyNews>(`/api/news/daily${query ? `?${query}` : ''}`);
  }

  /**
   * 获取单条新闻详情
   * @param id 新闻 ID
   * @param date 日期，默认今天
   */
  async getNewsItem(id: string, date?: string): Promise<NewsItem> {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    const query = params.toString();
    return this.request<NewsItem>(`/api/news/${id}${query ? `?${query}` : ''}`);
  }

  /**
   * 获取所有注册新闻源列表
   */
  async getSources(): Promise<NewsSource[]> {
    return this.request<NewsSource[]>('/api/news/sources');
  }

  /**
   * 手动触发新闻更新
   */
  async triggerUpdate(): Promise<{ success: boolean; completedAt: string; articlesFetched: number; newsItemsGenerated: number }> {
    return this.request('/api/news/trigger', { method: 'POST' });
  }
}

export const newsApiClient = new NewsApiClient();
export default NewsApiClient;
