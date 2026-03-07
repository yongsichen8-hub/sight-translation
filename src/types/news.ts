/**
 * Frontend news types - mirrors server/src/types/news.ts
 */

export type NewsDomain = 'ai' | 'tech' | 'economy' | 'politics';

export interface ArticleRef {
  articleId: string;
  sourceId: string;
  sourceName: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  publishedAt: string;
}

export interface NewsItem {
  id: string;
  topicSummary: string;
  domain: NewsDomain;
  secondaryDomains: NewsDomain[];
  chineseArticle: ArticleRef | null;
  englishArticle: ArticleRef | null;
  pairingStatus: 'paired' | 'zh-only' | 'en-only';
  importanceScore: number;
  rank: number;
  createdAt: string;
}

export interface DailyNews {
  date: string;
  items: NewsItem[];
  generatedAt: string;
}

export const DOMAIN_LABELS: Record<NewsDomain, string> = {
  ai: 'AI',
  tech: '科技',
  economy: '经济',
  politics: '国际政治',
};
