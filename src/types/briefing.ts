// Domain categories for study sessions and terms
export type BriefingDomain = 'ai-tech' | 'economy' | 'politics';

export const BRIEFING_DOMAIN_LABELS: Record<BriefingDomain, string> = {
  'ai-tech': 'AI科技',
  'economy': '国际经济/金融经济',
  'politics': '国际政治',
};

export interface StudySession {
  id: string;
  newsEntryId: string;
  newsDate: string;
  chineseTitle: string;
  chineseContent: string;
  englishUrl: string | null;
  englishContent: string | null;
  englishHtmlContent: string | null;
  englishSourceName: string | null;
  status: 'pending' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionInput {
  newsEntryId: string;
  newsDate: string;
  chineseTitle: string;
  chineseContent: string;
}

export interface Term {
  id: string;
  english: string;
  chinese: string;
  domain: BriefingDomain;
  context: string;
  studySessionId: string;
  sourceArticleTitle: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTermInput {
  english: string;
  chinese: string;
  domain: BriefingDomain;
  context: string;
  studySessionId: string;
  sourceArticleTitle: string;
}

export interface TermFilters {
  domain?: BriefingDomain;
  keyword?: string;
}
