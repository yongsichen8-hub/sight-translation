export type NewsDomain = 'ai-tech' | 'finance' | 'geopolitics' | 'automotive';

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  language: 'zh' | 'en';
  domain: NewsDomain;
  tier: 'T1' | 'T2';
  weight: number;
  enabled: boolean;
}

export interface RawArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  language: 'zh' | 'en';
  title: string;
  summary: string;
  content: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  domain: NewsDomain;
}

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
  updateResult: UpdateResult;
}

export interface SourceRegistry {
  version: number;
  sources: NewsSource[];
  lastUpdated: string;
}

export interface AggregationResult {
  articles: RawArticle[];
  errors: SourceError[];
  fetchedAt: string;
}

export interface SourceError {
  sourceId: string;
  sourceName: string;
  error: string;
  timestamp: string;
}

export interface UpdateResult {
  success: boolean;
  completedAt: string;
  articlesFetched: number;
  newsItemsGenerated: number;
  retryCount: number;
  errors: string[];
}
