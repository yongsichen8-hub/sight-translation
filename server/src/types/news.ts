// News domain categories
export type NewsDomain = 'ai' | 'tech' | 'economy' | 'politics';

// News source registered in Source Registry
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

// Raw article fetched from a news source
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

// Reference to an article within a NewsItem
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

// A bilingual news item (paired or single-language)
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

// Daily news output
export interface DailyNews {
  date: string;
  items: NewsItem[];
  generatedAt: string;
  updateResult: UpdateResult;
}

// Source registry file structure
export interface SourceRegistry {
  version: number;
  sources: NewsSource[];
  lastUpdated: string;
}

// Result of a news aggregation run
export interface AggregationResult {
  articles: RawArticle[];
  errors: SourceError[];
  fetchedAt: string;
}

// Error from a single source during aggregation
export interface SourceError {
  sourceId: string;
  sourceName: string;
  error: string;
  timestamp: string;
}

// Result of a scheduled update
export interface UpdateResult {
  success: boolean;
  completedAt: string;
  articlesFetched: number;
  newsItemsGenerated: number;
  retryCount: number;
  errors: string[];
}
