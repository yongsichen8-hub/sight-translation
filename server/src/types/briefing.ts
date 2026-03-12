// Domain categories for study sessions and terms
export type BriefingDomain = 'ai-tech' | 'economy' | 'politics';

export const BRIEFING_DOMAIN_LABELS: Record<BriefingDomain, string> = {
  'ai-tech': 'AI科技',
  'economy': '国际经济/金融经济',
  'politics': '国际政治',
};

// A bilingual study session linked to a news entry
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

// Input for creating a new study session
export interface CreateSessionInput {
  newsEntryId: string;
  newsDate: string;
  chineseTitle: string;
  chineseContent: string;
}

// Storage file structure for study sessions
export interface StudySessionsFile {
  version: number;
  sessions: StudySession[];
}

// A collected term from a study session
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

// Input for creating a new term
export interface CreateTermInput {
  english: string;
  chinese: string;
  domain: BriefingDomain;
  context: string;
  studySessionId: string;
  sourceArticleTitle: string;
}

// Filters for querying terms
export interface TermFilters {
  domain?: BriefingDomain;
  keyword?: string;
}

// Storage file structure for terms
export interface TermsFile {
  version: number;
  terms: Term[];
}

// Content extracted from a URL via Readability
export interface ExtractedContent {
  title: string;
  content: string;
  htmlContent: string;
  siteName: string;
  excerpt: string;
}
